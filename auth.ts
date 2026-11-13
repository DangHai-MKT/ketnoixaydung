import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { db } from "./db/client";
import {eq} from 'drizzle-orm';
import * as schema from "./db/schema/index";

import { sendIdentityEmail } from './lib/auth/email';
import { siteIdentity } from './lib/site/navigation';

export const auth = betterAuth({
  appName: siteIdentity.name,
  database: drizzleAdapter(db, {
    provider: "pg",
    transaction: true,
    schema: {
      ...schema,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
    },
  }),

  user: {
    modelName: "users",
    fields: {
      name: "displayName",
    },
    additionalFields: {
      status: { type: 'string', input: false, returned: false, defaultValue: 'active' },
    },
  },

  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 900,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({user,url}: {user:{email:string};url:string}) => { try { await sendIdentityEmail(user.email,url,'reset'); } catch { console.error('Không thể gửi email khôi phục; kiểm tra dịch vụ email.'); } },
    onPasswordReset: async ({user}) => { await db.insert(schema.auditLogs).values({actorId:user.id,entityType:'user',entityId:user.id,action:'user.password.reset'}); },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({user,url}, request) => {
      try {
        await sendIdentityEmail(user.email,url,'verify');
      } catch (error) {
        // Verification is optional at signup. Keep the account usable and allow retry.
        if (!request || !new URL(request.url).pathname.endsWith('/sign-up/email')) throw error;
        console.error('Không gửi được email xác thực khi đăng ký. Kiểm tra cấu hình và nhật ký Resend.');
      }
    },
    expiresIn: 900,
  },
  rateLimit: {
    enabled: !(process.env.NODE_ENV === 'development' && process.env.CONSTRUCTION_AUTH_TEST === '1'),
    storage: 'memory',
    window: 60,
    max: 100,
    customRules: {'/request-password-reset': {window:60,max:3}, '/reset-password': {window:60,max:5}, '/send-verification-email': {window:60,max:3}},
  },

  hooks: {
    after: createAuthMiddleware(async ctx => {
      if(ctx.context.returned instanceof APIError) return;
      if(ctx.path === '/sign-in/email' && ctx.context.newSession){
        const id=ctx.context.newSession.user.id;
        await db.transaction(async tx=>{await tx.update(schema.users).set({lastLoginAt:new Date()}).where(eq(schema.users.id,id));await tx.insert(schema.auditLogs).values({actorId:id,entityType:'user',entityId:id,action:'user.login'});});
      }
      if(ctx.path === '/change-password'){
        const session=await getSessionFromCtx(ctx,{disableCookieCache:true});
        if(session) await db.insert(schema.auditLogs).values({actorId:session.user.id,entityType:'user',entityId:session.user.id,action:'user.password.changed'});
      }
    }),
    before: createAuthMiddleware(async (ctx) => {
      const protectedPaths = ['/update-user', '/change-password', '/change-email', '/delete-user', '/delete-user/callback', '/link-social', '/unlink-account', '/get-access-token', '/refresh-token', '/account-info', '/list-accounts', '/list-sessions', '/revoke-session', '/revoke-sessions', '/revoke-other-sessions', '/verify-password'];
      if (protectedPaths.includes(ctx.path)) {
        const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
        if (!session) throw new APIError('UNAUTHORIZED', { message: 'Vui lòng đăng nhập để tiếp tục.' });
        const user = await ctx.context.internalAdapter.findUserById(session.user.id);
        if (!user || !('status' in user) || user.status !== 'active') {
          throw new APIError('FORBIDDEN', { message: 'Tài khoản hiện không được phép thực hiện thao tác này.' });
        }
      }
      if (ctx.path === '/sign-up/email' || ctx.path === '/update-user') {
        const body = ctx.body ?? {};
        if (['role', 'roles', 'status', 'userId', 'emailVerified'].some((key) => key in body)) {
          throw new APIError('FORBIDDEN', { message: 'Không được tự thay đổi quyền hoặc trạng thái tài khoản.' });
        }
        if (typeof body.name === 'string' && (!body.name.trim() || body.name.trim().length > 200)) {
          throw new APIError('BAD_REQUEST', { message: 'Tên hiển thị phải có từ 1 đến 200 ký tự.' });
        }
      }
    }),
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session, context) => {
          // Use Better Auth's transaction-aware adapter: registration's new user
          // is not visible through a separate PostgreSQL connection until commit.
          const user = await context?.context.internalAdapter.findUserById(session.userId);
          if (!user || !('status' in user) || user.status !== 'active') {
            throw new APIError('FORBIDDEN', { message: 'Tài khoản hiện không được phép đăng nhập.' });
          }
        },
      },
    },
  },

  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
});


