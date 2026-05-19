// bakery-bot.js

const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

// =========================
// CONFIG
// =========================


const BOT_TOKEN = process.env.BOT_TOKEN;

const BAKERS_INFO = {
  "404715:63498192a6d00df1ee0358bcdfccf1f2": -1002021404150,
};

const CUSTOM_INTERESTING_PRODUCTS_ID = [2, 5, 8];
const CUSTOM_DATE = "";

const MESSAGE_TEMPLATE = `
Всім привіт!

Звіт за: {date}

{amount}

{products}

Дякую кожному та на зв'язку!
`;

const SUM_LINK_TEMPLATE =
  "https://joinposter.com/api/dash.getCategoriesSales?token={token}&dateFrom={date}&dateTo={date}";

const PRODUCT_INFO_LINK_TEMPLATE =
  "https://joinposter.com/api/dash.getProductsSales?token={token}&dateFrom={date}&dateTo={date}";

// =========================
// INIT
// =========================

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const INTERESTING_PRODUCTS_ID =
  CUSTOM_INTERESTING_PRODUCTS_ID.length > 0
    ? CUSTOM_INTERESTING_PRODUCTS_ID
    : [2, 5];

const DATE = CUSTOM_DATE || getCurrentDate();

// =========================
// HELPERS
// =========================

function getCurrentDate() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const day = String(now.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function getFormatDate(dateStr) {
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);

  return `${day}.${month}.${year}`;
}

async function sendMessage(chatId, message) {
  try {
    await bot.sendMessage(chatId, message);
    console.log(`✅ Message sent to ${chatId}`);
  } catch (error) {
    console.error("❌ Telegram send error:", error.message);
  }
}

function generateMessage(amountInfo, productsInfo) {
  const [count, kg] = amountInfo;

  const amount = kg
    ? `Всього продали: ${kg} кг. та ${parseInt(count)} шт.`
    : `Всього продали: ${parseInt(count)} шт.`;

  const productsTable = Object.entries(productsInfo)
    .map(([product, count]) => {
      return `${product}: ${count} ${
        Number.isInteger(count) ? "шт" : "кг"
      }.`;
    })
    .join("\n");

  return MESSAGE_TEMPLATE
    .replace("{date}", getFormatDate(DATE))
    .replace("{amount}", amount)
    .replace("{products}", productsTable);
}

// =========================
// API
// =========================

async function getAmountInfo(token) {
  try {
    const url = SUM_LINK_TEMPLATE
      .replace("{token}", token)
      .replaceAll("{date}", DATE);

    const response = await axios.get(url);

    const data = response.data.response;

    const amountOfSoldBakeryProducts = data
      .filter((item) =>
        INTERESTING_PRODUCTS_ID.includes(Number(item.category_id))
      )
      .reduce((sum, item) => sum + parseFloat(item.num), 0);

    let amountOfSoldKgProducts = data
      .filter((item) =>
        INTERESTING_PRODUCTS_ID.includes(Number(item.category_id))
      )
      .reduce((sum, item) => sum + parseFloat(item.weight), 0);

    amountOfSoldKgProducts =
      amountOfSoldKgProducts > 0
        ? amountOfSoldKgProducts / 1000
        : 0;

    return [
      amountOfSoldBakeryProducts,
      Number(amountOfSoldKgProducts.toFixed(2)),
    ];
  } catch (error) {
    console.error("❌ Amount info error:", error.message);
    return null;
  }
}

async function getProductsInfo(token) {
  try {
    const url = PRODUCT_INFO_LINK_TEMPLATE
      .replace("{token}", token)
      .replaceAll("{date}", DATE);

    const response = await axios.get(url);

    console.log(JSON.stringify(response.data, null, 2));

    const products = response.data.response
      .filter((item) =>
        INTERESTING_PRODUCTS_ID.includes(Number(item.category_id))
      )
      .map((item) => {
        const count =
          item.unit === "p"
            ? parseInt(parseFloat(item.count))
            : parseFloat(item.count);

        return [item.product_name, count];
      });

    products.sort((a, b) => b[1] - a[1]);

    const result = {};

    for (const [name, count] of products) {
      result[name] = count;
    }

    return result;
  } catch (error) {
    console.error("❌ Products info error:", error.message);
    return null;
  }
}

// =========================
// MAIN
// =========================

async function main() {
  for (const [token, chatId] of Object.entries(BAKERS_INFO)) {
    console.log(`📦 Processing chat ${chatId}`);

    const amountInfo = await getAmountInfo(token);

    const productsInfo = await getProductsInfo(token);

    if (amountInfo && productsInfo) {
      const message = generateMessage(amountInfo, productsInfo);

      console.log(message);

      // await sendMessage(chatId, message);
    }
  }
}

main();
