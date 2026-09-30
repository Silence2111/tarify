import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import {
  deliverLead,
  fillTemplate,
  leadFields,
  leadNotice,
  normalizePhone,
} from "@/lib/lead-delivery";
import { escapeHtml } from "@/lib/telegram";

/**
 * Передача заявки в сеть — это деньги: заявка, которая не дошла, не превратится в
 * подключение, а дошедшая без метки не вернётся постбэком. Уведомление оператору —
 * скорость обзвона, но без персональных данных: они не уходят в Telegram.
 */

const LEAD = {
  id: "lead1",
  name: "Иван Петров",
  phone: "+7 (900) 123-45-67",
  company: null,
  addressText: "Казань, улица Баумана, д. 1",
  createdAt: new Date("2026-09-30T05:00:00Z"),
  plan: { name: "Технологии общения 100", provider: { name: "Ростелеком", slug: "rostelecom" } },
  building: { street: { city: { name: "Казань" } } },
};

describe("поля заявки для сети", () => {
  it("телефон — 11 цифр с семёркой", () => {
    expect(normalizePhone("+7 (900) 123-45-67")).toBe("79001234567");
    expect(normalizePhone("8 900 123 45 67")).toBe("79001234567");
    expect(normalizePhone("900-123-45-67")).toBe("79001234567");
  });

  it("шаблон адреса: значения кодируются, незнакомые скобки не трогаются", () => {
    const f = leadFields(LEAD);
    expect(
      fillTemplate("https://net.ru/api/lead?token=T&phone={phone_digits}&name={name}&sub={subid}&x={x}", f),
    ).toBe(
      `https://net.ru/api/lead?token=T&phone=79001234567&name=${encodeURIComponent("Иван Петров")}&sub=lead1&x={x}`,
    );
    // Битрикс24: поля в квадратных скобках остаются как есть.
    expect(fillTemplate("https://b24.ru/rest/1/K/crm.lead.add.json?FIELDS[TITLE]={id}", f)).toBe(
      "https://b24.ru/rest/1/K/crm.lead.add.json?FIELDS[TITLE]=lead1",
    );
  });

  it("уведомление оператору — без имени, телефона и адреса", () => {
    const text = leadNotice(leadFields(LEAD));
    expect(text).toContain("Ростелеком «Технологии общения 100» · Казань");
    expect(text).not.toMatch(/Иван|900|Баумана/);
  });

  it("HTML в названиях экранируется", () => {
    expect(escapeHtml("<b>Тариф & Co</b>")).toBe("&lt;b&gt;Тариф &amp; Co&lt;/b&gt;");
  });
});

describe("передача заявки", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    db.lead.findUnique.mockResolvedValue(LEAD);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("принята — отметка о передаче, в теле JSON с меткой subid", async () => {
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://net.ru/api/lead?sub={subid}");
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    expect(await deliverLead("lead1")).toEqual({ delivered: true, error: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://net.ru/api/lead?sub=lead1");
    expect(JSON.parse(init.body)).toMatchObject({ subid: "lead1", phone_digits: "79001234567" });
    expect(db.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { deliveredAt: expect.any(Date), deliveryError: null },
    });
  });

  it("ошибка сети — сохраняется, чтобы отправить ещё раз из админки", async () => {
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://net.ru/api/lead");
    fetchMock.mockResolvedValue(new Response("offer paused", { status: 500 }));

    expect(await deliverLead("lead1")).toEqual({
      delivered: false,
      error: "HTTP 500: offer paused",
    });
    expect(db.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: { deliveryError: "HTTP 500: offer paused" },
    });
  });

  it("без адреса приёма в сеть ничего не уходит; оператору — только уведомление", async () => {
    vi.stubEnv("LEAD_WEBHOOK_URL", "");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_LEADS_CHAT_ID", "-100500");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    expect(await deliverLead("lead1")).toEqual({ delivered: false, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe("-100500");
    expect(body.text).not.toContain("900");
    expect(db.lead.update).not.toHaveBeenCalled();
  });

  it("сбой базы или сети не бросает — заявка уже принята", async () => {
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://net.ru/api/lead");
    fetchMock.mockRejectedValue(new Error("timeout"));
    expect(await deliverLead("lead1")).toMatchObject({ delivered: false, error: "timeout" });

    db.lead.findUnique.mockRejectedValue(new Error("db down"));
    await expect(deliverLead("lead1")).resolves.toMatchObject({ delivered: false });
  });
});
