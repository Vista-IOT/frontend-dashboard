import { NextRequest, NextResponse } from 'next/server';

// Function to verify credentials with backend
async function verifyCredentials(authHeader: string): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8000/api/admin/verify', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip auth for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') && !pathname.endsWith('.html')
  ) {
    return NextResponse.next();
  }
  
  // Handle CORS for all API routes
  if (pathname.startsWith('/api/') || pathname.startsWith('/deploy/')) {
    const response = NextResponse.next();
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { 
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }
    
    return response;
  }
  
  // HTTP Basic Auth for dashboard pages (except onboarding and static assets)
  if (!pathname.startsWith('/onboarding')) {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Vista IoT Dashboard"',
        },
      });
    }
    
    // Verify credentials with backend
    const isValid = await verifyCredentials(authHeader);
    
    if (!isValid) {
      return new NextResponse('Invalid credentials', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Vista IoT Dashboard"',
        },
      });
    }
    
    // Pass the auth header to the response so it's available for API calls
    const response = NextResponse.next();
    response.headers.set('x-auth-user', authHeader);
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
