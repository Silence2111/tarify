#!/usr/bin/env python3
"""Технический обход сайта «Тарифы» для SEO-аудита.

Обходит сайт по внутренним ссылкам и по sitemap.xml, соблюдая robots.txt, и по каждой
странице собирает: код ответа, title, description, h1, canonical, meta robots, типы
микроразметки Schema.org и входящие ссылки. Итог — pages.csv и сводка проблем.

Боевой адрес можно подменить локальным: ссылки и canonical пишутся с боевым доменом,
а запросы уходят на локальную сборку.

    python3 seo/tarify/crawl.py --site https://tarify.rumedia-cdn.com \\
        --fetch http://127.0.0.1:3000 --out /tmp/crawl

Зависимости: requests, beautifulsoup4.
"""

import argparse
import csv
import json
import time
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict, deque
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup

TITLE_MAX = 70
DESCRIPTION_MAX = 160
MAX_DEPTH = 3


def normalize(url: str) -> str:
    """Без фрагмента; путь без завершающего слэша (кроме корня)."""
    parts = urlsplit(url)
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, ""))


class Crawler:
    def __init__(self, site: str, fetch: str, limit: int, delay: float):
        self.site = site.rstrip("/")
        self.fetch_base = fetch.rstrip("/")
        self.limit = limit
        self.delay = delay
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "tarify-seo-audit/1.0"
        self.rules: list[tuple[str, bool]] = []  # (префикс пути, разрешено)
        self.pages: dict[str, dict] = {}
        self.inlinks: dict[str, set[str]] = defaultdict(set)
        self.depth: dict[str, int] = {}

    def to_fetch(self, url: str) -> str:
        return self.fetch_base + url[len(self.site):] if url.startswith(self.site) else url

    def internal(self, url: str) -> bool:
        return urlsplit(url).netloc == urlsplit(self.site).netloc

    def get(self, url: str) -> requests.Response:
        time.sleep(self.delay)
        return self.session.get(self.to_fetch(url), allow_redirects=False, timeout=30)

    def load_robots(self) -> str:
        """Правила группы User-Agent: * — как их читают Яндекс и Google."""
        text = self.get(self.site + "/robots.txt").text
        group = False
        for line in text.splitlines():
            key, _, value = line.partition(":")
            key, value = key.strip().lower(), value.strip()
            if key == "user-agent":
                group = value == "*"
            elif group and key in ("allow", "disallow") and value:
                self.rules.append((value, key == "allow"))
        return text

    def allowed(self, url: str) -> bool:
        """Побеждает самое длинное совпавшее правило (стандарт Яндекса и Google), а не
        первое по порядку, как в urllib.robotparser."""
        path = urlsplit(url).path or "/"
        best = max((r for r in self.rules if path.startswith(r[0])), key=lambda r: len(r[0]), default=None)
        return best is None or best[1]

    def load_sitemap(self) -> list[str]:
        r = self.get(self.site + "/sitemap.xml")
        return [normalize(loc.text.strip()) for loc in ET.fromstring(r.content).iterfind(".//{*}loc")]

    def page(self, url: str) -> dict:
        r = self.get(url)
        info = {"url": url, "status": r.status_code, "location": r.headers.get("location", "")}
        if r.status_code != 200 or "text/html" not in r.headers.get("content-type", ""):
            return info
        soup = BeautifulSoup(r.text, "html.parser")
        meta = lambda name: (soup.find("meta", attrs={"name": name}) or {}).get("content", "")
        canonical = soup.find("link", rel="canonical")
        types = []
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(tag.string or "")
            except json.JSONDecodeError:
                types.append("НЕВАЛИДНЫЙ JSON-LD")
                continue
            for item in data if isinstance(data, list) else data.get("@graph", [data]):
                types.append(str(item.get("@type", "?")))
        links = set()
        for a in soup.find_all("a", href=True):
            href = urljoin(url, a["href"])
            if href.startswith(("http://", "https://")) and self.internal(href):
                links.add(normalize(href))
        main = soup.find("main") or soup.body
        info.update(
            title=(soup.title.string or "").strip() if soup.title else "",
            description=meta("description"),
            robots=meta("robots"),
            canonical=normalize(urljoin(url, canonical["href"])) if canonical else "",
            h1=[h.get_text(" ", strip=True) for h in soup.find_all("h1")],
            jsonld=types,
            words=len(main.get_text(" ", strip=True).split()) if main else 0,
            links=sorted(links),
        )
        return info

    def crawl(self, seeds: list[str]) -> None:
        queue = deque()
        start = normalize(self.site + "/")
        self.depth[start] = 0
        queue.append(start)
        for s in seeds:  # из sitemap — глубину посчитаем по ссылкам, если дойдём
            queue.append(s)
        while queue and len(self.pages) < self.limit:
            url = queue.popleft()
            if url in self.pages or not self.allowed(url):
                continue
            info = self.page(url)
            self.pages[url] = info
            if info["status"] in (301, 302, 307, 308) and info["location"]:
                target = normalize(urljoin(url, info["location"]))
                if self.internal(target) and target not in self.pages:
                    queue.append(target)
            for link in info.get("links", []):
                self.inlinks[link].add(url)
                if link not in self.depth and url in self.depth:
                    self.depth[link] = self.depth[url] + 1
                if link not in self.pages:
                    queue.append(link)


def indexable(p: dict) -> bool:
    return p["status"] == 200 and "noindex" not in p.get("robots", "") and p.get("canonical") in ("", p["url"])


def report(c: Crawler, sitemap: list[str], robots_txt: str, out: Path) -> str:
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "pages.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "status", "location", "title", "title_len", "description_len", "h1",
                    "canonical", "robots", "jsonld", "words", "inlinks", "depth", "in_sitemap"])
        for url, p in sorted(c.pages.items()):
            w.writerow([url, p["status"], p.get("location", ""), p.get("title", ""), len(p.get("title", "")),
                        len(p.get("description", "")), " | ".join(p.get("h1", [])), p.get("canonical", ""),
                        p.get("robots", ""), ", ".join(p.get("jsonld", [])), p.get("words", ""),
                        len(c.inlinks.get(url, ())), c.depth.get(url, ""), url in sitemap])

    pages = c.pages
    ok = {u: p for u, p in pages.items() if p["status"] == 200 and "title" in p}
    idx = {u: p for u, p in ok.items() if indexable(p)}
    lines = [f"Обойдено страниц: {len(pages)}; отвечают 200: {len(ok)}; индексируемых: {len(idx)}; в sitemap: {len(sitemap)}"]

    def section(name: str, items: list[str]) -> None:
        lines.append(f"\n## {name}: {len(items)}")
        lines.extend(f"- {i}" for i in items[:40])
        if len(items) > 40:
            lines.append(f"- … и ещё {len(items) - 40}")

    broken = sorted({f"{u} ← {sorted(c.inlinks[u])[0]}" for u, p in pages.items() if p["status"] >= 400 and c.inlinks.get(u)})
    section("Битые внутренние ссылки (4xx/5xx)", broken)
    redirects = sorted(f"{u} → {p['location']} ({p['status']})" for u, p in pages.items() if 300 <= p["status"] < 400)
    section("Внутренние ссылки на перенаправления", [r for r in redirects if c.inlinks.get(r.split(' ')[0])])
    section("В sitemap, но не 200", sorted(f"{u}: {pages[u]['status']}" for u in sitemap if u in pages and pages[u]["status"] != 200))
    section("В sitemap, но noindex или чужой canonical", sorted(u for u in sitemap if u in ok and not indexable(ok[u])))
    section("Индексируемые, но не в sitemap", sorted(u for u in idx if u not in sitemap))
    section("Без входящих ссылок (сироты)", sorted(u for u in sitemap if not c.inlinks.get(u) and u != normalize(c.site + "/")))
    section(f"Глубже {MAX_DEPTH} кликов от главной", sorted(f"{u}: {c.depth[u]}" for u in idx if c.depth.get(u, 0) > MAX_DEPTH))
    section("Нет title", sorted(u for u, p in idx.items() if not p["title"]))
    section(f"Title длиннее {TITLE_MAX}", sorted(f"{u}: {len(p['title'])} — {p['title']}" for u, p in idx.items() if len(p["title"]) > TITLE_MAX))
    section("Нет description", sorted(u for u, p in idx.items() if not p["description"]))
    section(f"Description длиннее {DESCRIPTION_MAX}", sorted(f"{u}: {len(p['description'])}" for u, p in idx.items() if len(p["description"]) > DESCRIPTION_MAX))
    titles = Counter(p["title"] for p in idx.values())
    section("Повторяющиеся title", sorted(f"{t} ×{n}: " + ", ".join(sorted(u for u, p in idx.items() if p["title"] == t)[:4]) for t, n in titles.items() if n > 1))
    descs = Counter(p["description"] for p in idx.values() if p["description"])
    section("Повторяющиеся description", sorted(f"×{n}: " + ", ".join(sorted(u for u, p in idx.items() if p["description"] == d)[:4]) for d, n in descs.items() if n > 1))
    section("H1 не один", sorted(f"{u}: {len(p['h1'])}" for u, p in idx.items() if len(p["h1"]) != 1))
    section("Нет canonical", sorted(u for u, p in idx.items() if not p["canonical"]))
    section("Мало текста (< 120 слов)", sorted(f"{u}: {p['words']}" for u, p in idx.items() if p["words"] < 120))
    types = Counter(t for p in idx.values() for t in p["jsonld"])
    lines.append("\n## Микроразметка на индексируемых страницах")
    lines.append(", ".join(f"{t}: {n}" for t, n in types.most_common()) or "нет")
    section("Индексируемые без микроразметки", sorted(u for u, p in idx.items() if not p["jsonld"]))
    lines.append("\n## robots.txt\n" + robots_txt.strip())
    text = "\n".join(lines)
    (out / "summary.md").write_text(text, encoding="utf-8")
    return text


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", required=True, help="боевой адрес, как в canonical и sitemap")
    ap.add_argument("--fetch", help="откуда реально скачивать (локальная сборка); по умолчанию --site")
    ap.add_argument("--out", default="crawl-out", help="папка для pages.csv и summary.md")
    ap.add_argument("--limit", type=int, default=3000)
    ap.add_argument("--delay", type=float, default=0.05, help="пауза между запросами, с")
    a = ap.parse_args()
    c = Crawler(a.site, a.fetch or a.site, a.limit, a.delay)
    robots_txt = c.load_robots()
    sitemap = c.load_sitemap()
    c.crawl(sitemap)
    print(report(c, sitemap, robots_txt, Path(a.out)))


if __name__ == "__main__":
    main()
