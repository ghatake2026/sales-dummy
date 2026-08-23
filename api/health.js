const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY_CANDIDATES = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SECRET_KEY,
];
const SUPABASE_KEY = SUPABASE_KEY_CANDIDATES.find((key) => {
  return key && (key.startsWith("eyJ") || key.startsWith("sb_secret_"));
});

function getKeyType(key) {
  if (!key) return "missing";
  if (key.startsWith("eyJ")) return "legacy_service_role_jwt";
  if (key.startsWith("sb_secret_")) return "secret_key";
  return "invalid_format";
}

function getSupabaseHeaders() {
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
  };

  if (SUPABASE_KEY && SUPABASE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  return headers;
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const diagnostics = {
    supabaseUrlConfigured: Boolean(SUPABASE_URL),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    secretKeyConfigured: Boolean(process.env.SUPABASE_SECRET_KEY),
    selectedKeyType: getKeyType(SUPABASE_KEY),
    table: "sales_dummy_orders",
  };

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).json({
      ok: false,
      diagnostics,
      error: "Supabase URL or valid server key is missing.",
    });
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sales_dummy_orders?select=id&limit=1`,
      { headers: getSupabaseHeaders() }
    );
    const data = await readResponseBody(response);

    res.status(response.ok ? 200 : 500).json({
      ok: response.ok,
      diagnostics,
      supabaseStatus: response.status,
      supabaseStatusText: response.statusText,
      supabaseResponse: data,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      diagnostics,
      error: error.message,
    });
  }
};
