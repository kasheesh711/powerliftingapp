import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import { saveGoogleTokenPayload } from './lib/token-vault-repo';

const isProduction = process.env.NODE_ENV === 'production';
const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const authSecret =
  process.env.NEXTAUTH_SECRET || (isProduction ? undefined : 'local-dev-nextauth-secret');
const trustHost = process.env.AUTH_TRUST_HOST === 'false' ? false : true;

const providers = googleConfigured
  ? [
      Google({
        authorization: {
          params: {
            scope:
              'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })
    ]
  : [
      Credentials({
        name: 'Local Dev',
        credentials: {},
        async authorize() {
          return {
            id: 'local-dev',
            email: 'local-dev@example.com',
            name: 'Local Dev User'
          };
        }
      })
    ];

type JwtCallbackParams = Parameters<
  NonNullable<NonNullable<NextAuthConfig['callbacks']>['jwt']>
>[0];
type SessionCallbackParams = Parameters<
  NonNullable<NonNullable<NextAuthConfig['callbacks']>['session']>
>[0];

const config: NextAuthConfig = {
  secret: authSecret,
  trustHost,
  providers,
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, account, user }: JwtCallbackParams) {
      const userId =
        String(token.email || token.sub || user?.email || user?.id || 'local-dev').toLowerCase();

      if (account?.provider === 'google' && account.access_token) {
        await saveGoogleTokenPayload(userId, {
          access_token: account.access_token,
          refresh_token: account.refresh_token ?? null,
          expiry_date: account.expires_at ? account.expires_at * 1000 : null,
          scope: account.scope,
          token_type: account.token_type
        });
      }

      return token;
    },
    async session({ session, token }: SessionCallbackParams) {
      if (session.user && !session.user.email && token.email) {
        session.user.email = token.email;
      }

      return session;
    }
  }
};

const nextAuth = NextAuth(config);

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = nextAuth.auth as () => Promise<{ user?: { email?: string | null } } | null>;
