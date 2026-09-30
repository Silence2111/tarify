// Пароль админки и его хэш для ADMIN_PASSWORD_HASH (см. lib/admin-auth.ts).
//   npm run admin:password             — новый случайный пароль
//   npm run admin:password -- 'пароль' — хэш своего пароля
// Хэш — в переменную ADMIN_PASSWORD_HASH (Vercel → Settings → Environment Variables,
// затем Redeploy) или в константу OWNER_PASSWORD_HASH в lib/admin-auth.ts.
import { randomInt } from "node:crypto";
import { hashPassword } from "../lib/admin-auth";

// Без похожих друг на друга символов (0/O, 1/l/I) — пароль удобно перепечатывать.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

const password =
  process.argv[2] || Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

hashPassword(password).then((hash) => {
  console.log(`Пароль: ${password}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
});
