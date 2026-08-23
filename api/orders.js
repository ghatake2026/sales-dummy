const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY_CANDIDATES = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SECRET_KEY,
];
const SUPABASE_KEY = SUPABASE_KEY_CANDIDATES.find((key) => {
  return key && (key.startsWith("eyJ") || key.startsWith("sb_secret_"));
});

const TABLE_NAME = "sales_dummy_orders";
const COLUMNS = [
  "customerName",
  "customerContact",
  "orderNumber",
  "propertyName",
  "deliveryName",
  "postalCode",
  "prefecture",
  "address",
  "receivingContact",
  "phone",
  "expectedSalesDate",
];

function getSupabaseHeaders() {
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
  };

  // Legacy service_role keys are JWTs. New sb_secret_ keys must be sent only as apikey.
  if (SUPABASE_KEY && SUPABASE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  return headers;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function sanitizeOrder(input) {
  return COLUMNS.reduce((order, column) => {
    const value = input[column];
    order[column] = value === "" || value === undefined ? null : value;
    return order;
  }, {});
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function sendSupabaseResponse(res, response, data) {
  if (!response.ok) {
    console.error("Supabase request failed", {
      status: response.status,
      statusText: response.statusText,
      data,
    });
  }

  res.status(response.status).json(data);
}

module.exports = async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({
      error: "Supabase environment variables are not configured or the key format is invalid.",
    });
    return;
  }

  if (req.method === "GET") {
    const select = ["id", ...COLUMNS, "created_at"].join(",");
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=${encodeURIComponent(select)}&order=created_at.desc`,
      { headers: getSupabaseHeaders() }
    );
    const data = await readResponseBody(response);
    sendSupabaseResponse(res, response, data);
    return;
  }

  if (req.method === "POST") {
    const order = sanitizeOrder(parseBody(req));
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify(order),
    });
    const data = await readResponseBody(response);
    sendSupabaseResponse(res, response, data);
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
};
