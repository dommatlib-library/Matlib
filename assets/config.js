
(() => {
  "use strict";

  /*
   * =========================================================
   * MATLIB - SUPABASE CONFIGURATION
   * =========================================================
   *
   * This file contains only the public Supabase URL and
   * anonymous key required by the browser application.
   *
   * NEVER put these in this file:
   * - Google Client Secret
   * - Google Refresh Token
   * - Supabase Service Role Key
   * - Any other private secret
   *
   * Those secrets belong only in Supabase Edge Functions.
   * =========================================================
   */

 window.MATLIB_SUPABASE_URL =
    "https://eyphijgyrovsesadvfzj.supabase.co";


  // ------------------------------------------------------------
  // SUPABASE ANON / PUBLISHABLE KEY
  // ------------------------------------------------------------

  window.MATLIB_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGhpamd5cm92c2VzYWR2ZnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjM2MDMsImV4cCI6MjEwMzEzOTYwM30.40PybhewqbhyqTZC7Z2_rB5fKt4Kr7mwVFp4SZP2r3I";

  const configured = Boolean(
    window.MATLIB_SUPABASE_URL &&
    window.MATLIB_SUPABASE_ANON_KEY &&
    !window.MATLIB_SUPABASE_URL.includes("YOUR_") &&
    !window.MATLIB_SUPABASE_ANON_KEY.includes("YOUR_")
  );

  /*
   * ---------------------------------------------------------
   * Make sure Supabase JS library is loaded first.
   *
   * HTML must contain:
   *
   * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   * <script src="assets/config.js"></script>
   * <script src="assets/app.js"></script>
   * ---------------------------------------------------------
   */

  if (!window.supabase) {
    console.error(
      "MatLib: Supabase JavaScript library was not loaded."
    );

    window.matlibSupabase = null;

    window.matlib = {
      sb: null
    };

    return;
  }

  /*
   * ---------------------------------------------------------
   * Stop if configuration is missing.
   * ---------------------------------------------------------
   */

  if (!configured) {
    console.error(
      "MatLib: Supabase configuration is missing."
    );

    window.matlibSupabase = null;

    window.matlib = {
      sb: null
    };

    return;
  }

  /*
   * ---------------------------------------------------------
   * Create the Supabase client only once.
   * ---------------------------------------------------------
   */

  if (!window.matlibSupabase) {
    window.matlibSupabase =
      window.supabase.createClient(
        window.MATLIB_SUPABASE_URL,
        window.MATLIB_SUPABASE_ANON_KEY
      );
  }

  /*
   * ---------------------------------------------------------
   * Global MatLib object
   *
   * app.js can use:
   *
   * const sb = window.matlibSupabase;
   *
   * or:
   *
   * const sb = window.matlib.sb;
   * ---------------------------------------------------------
   */

  window.matlib = {
    sb: window.matlibSupabase
  };

  console.log(
    "MatLib: Supabase connected successfully."
  );
})();