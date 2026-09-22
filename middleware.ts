import { next } from '@vercel/edge';

export const config = {
  matcher: ['/((?!api|_vercel|.*\\..*).*)'],
};

export default async function middleware(req: Request) {
  try {
    const url = new URL(req.url);
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return next();
    }

    // Fetch the launch config from Supabase directly via REST
    const res = await fetch(`${supabaseUrl}/rest/v1/admin_settings?key=eq.launch_config&select=value`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    if (!res.ok) return next();
    
    const data = await res.json();
    if (!data || data.length === 0) return next();

    const mode = data[0].value?.mode || 'live';
    const path = url.pathname;
    
    // Only intercept paths starting with /app. This keeps the public homepage (/) accessible!
    const isAppRoute = path.startsWith('/app');

    if (mode === 'coming_soon') {
      if (isAppRoute) {
        url.pathname = '/coming-soon';
        return Response.redirect(url, 302);
      }
    } else if (mode === 'early_access') {
      if (isAppRoute) {
        // If they specifically clicked "Already approved? Log in here" with ?login=true, let them hit the login page
        if (path === '/app/login' && url.searchParams.get('login') === 'true') {
          return next();
        }
        
        // Otherwise, block access to the app and send them to the early access waitlist form
        url.pathname = '/early-access';
        return Response.redirect(url, 302);
      }
    } else if (mode === 'live') {
      if (path === '/coming-soon' || path === '/early-access') {
        url.pathname = '/';
        return Response.redirect(url, 302);
      }
    }

    return next();
  } catch (e) {
    return next();
  }
}
