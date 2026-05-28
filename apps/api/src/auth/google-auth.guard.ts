import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly auth: AuthService) {
    super();
  }

  async getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ ip?: string }>();
    const state = await this.auth.createOAuthState(
      'google',
      req.ip ?? 'unknown',
    );
    return { state };
  }
}
