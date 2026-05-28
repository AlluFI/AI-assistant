import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MfaCompleteDto } from './dto/mfa-complete.dto';
import { TotpConfirmDto } from './dto/totp-confirm.dto';
import { TotpDisableDto } from './dto/totp-disable.dto';
import { BackupRegenerateDto } from './dto/backup-regenerate.dto';
import { AccountUpdateDto } from './dto/account-update.dto';
import { ChangeEmailRequestDto } from './dto/change-email-request.dto';
import { ChangeEmailConfirmDto } from './dto/change-email-confirm.dto';
import { GoogleAuthGuard } from './google-auth.guard';
import { GithubAuthGuard } from './github-auth.guard';

type AuthRequest = Request & { user: { userId: string; email: string } };
type OAuthRequest = Request & {
  user: { userId: string };
  query: { state?: string };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieSecure() {
    return this.config.get<boolean>('COOKIE_SECURE') ?? false;
  }

  private cookieOnlyRefresh() {
    return this.config.get<boolean>('AUTH_REFRESH_COOKIE_ONLY') ?? false;
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure(),
      path: '/api/auth',
      maxAge:
        Number(this.config.get<string>('JWT_REFRESH_EXPIRES_SEC') ?? 604800) *
        1000,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie('refresh_token', {
      path: '/api/auth',
      sameSite: 'lax',
      secure: this.cookieSecure(),
      httpOnly: true,
    });
  }

  private setCsrfCookie(res: Response, csrfToken: string) {
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: this.cookieSecure(),
      path: '/api',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  private getCookie(req: Request, name: string) {
    const source = req.headers.cookie;
    if (!source) return undefined;
    const parts = source.split(';').map((p) => p.trim());
    const item = parts.find((p) => p.startsWith(`${name}=`));
    if (!item) return undefined;
    return decodeURIComponent(item.slice(name.length + 1));
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    if ('refreshToken' in result) {
      this.setRefreshCookie(res, result.refreshToken);
      const csrf = await this.auth.issueCsrfToken(result.userId);
      this.setCsrfCookie(res, csrf);
    }
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('mfa/complete')
  async mfaComplete(
    @Body() dto: MfaCompleteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.auth.completeMfaLogin(
      dto.mfaToken,
      dto.totpCode,
      dto.backupCode,
    );
    if ('refreshToken' in out) {
      this.setRefreshCookie(res, out.refreshToken);
      const csrf = await this.auth.issueCsrfToken(out.userId);
      this.setCsrfCookie(res, csrf);
    }
    return out;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Headers('x-csrf-token') csrfHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (this.cookieOnlyRefresh() && dto.refreshToken) {
      throw new BadRequestException(
        'Refresh token in request body is disabled; use cookie flow.',
      );
    }
    const bodyToken = dto.refreshToken;
    const cookieToken = this.getCookie(req, 'refresh_token');
    const refreshToken = bodyToken || cookieToken;
    if (!refreshToken) {
      throw new BadRequestException('Missing refresh token');
    }
    if (!bodyToken) {
      const userIdHint = this.auth.getRefreshTokenUserId(refreshToken);
      const csrfCookie = this.getCookie(req, 'csrf_token');
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        throw new UnauthorizedException('CSRF token mismatch');
      }
      const csrfOk = await this.auth.verifyCsrfToken(userIdHint, csrfHeader);
      if (!csrfOk) {
        throw new UnauthorizedException('Invalid CSRF token');
      }
    }

    const result = await this.auth.refreshTokens(refreshToken);
    this.setRefreshCookie(res, result.refreshToken);
    const csrf = await this.auth.issueCsrfToken(result.userId);
    this.setCsrfCookie(res, csrf);
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken || this.getCookie(req, 'refresh_token');
    if (!refreshToken) {
      this.clearRefreshCookie(res);
      return { message: 'No active session token found.' };
    }
    this.clearRefreshCookie(res);
    return this.auth.logout(refreshToken);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
    return this.auth.logoutAll(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('csrf')
  async csrf(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.issueCsrfToken(req.user.userId);
    this.setCsrfCookie(res, token);
    return { csrfToken: token };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Patch('account')
  updateAccount(@Req() req: AuthRequest, @Body() dto: AccountUpdateDto) {
    return this.auth.updateAccount(req.user.userId, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('change-email/request')
  requestEmailChange(
    @Req() req: AuthRequest,
    @Body() dto: ChangeEmailRequestDto,
  ) {
    return this.auth.requestEmailChange(req.user.userId, dto.newEmail);
  }

  @Post('change-email/confirm')
  confirmEmailChange(@Body() dto: ChangeEmailConfirmDto) {
    return this.auth.confirmEmailChange(dto.token);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    /* redirects to Google */
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    await this.auth.consumeOAuthState('google', req.query?.state);
    return this.oauthRedirect(req, res);
  }

  @Get('github')
  @UseGuards(GithubAuthGuard)
  githubAuth() {
    /* redirects to GitHub */
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: OAuthRequest, @Res() res: Response) {
    await this.auth.consumeOAuthState('github', req.query?.state);
    return this.oauthRedirect(req, res);
  }

  private async oauthRedirect(req: OAuthRequest, res: Response) {
    const tokens = await this.auth.issueTokenPair(req.user.userId);
    this.setRefreshCookie(res, tokens.refreshToken);
    const csrf = await this.auth.issueCsrfToken(req.user.userId);
    this.setCsrfCookie(res, csrf);
    const web = this.config.getOrThrow<string>('WEB_APP_URL');
    const base = web.replace(/\/$/, '');
    const fragment = new URLSearchParams({
      access_token: tokens.accessToken,
    }).toString();
    return res.redirect(302, `${base}/oauth/callback#${fragment}`);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('totp/setup')
  totpSetup(@Req() req: AuthRequest) {
    return this.auth.beginTotpSetup(req.user.userId);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('totp/confirm')
  totpConfirm(@Req() req: AuthRequest, @Body() dto: TotpConfirmDto) {
    return this.auth.confirmTotpSetup(req.user.userId, dto.code);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('totp/disable')
  totpDisable(@Req() req: AuthRequest, @Body() dto: TotpDisableDto) {
    return this.auth.disableTotp(req.user.userId, dto.password);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('totp/backup-codes/regenerate')
  backupRegenerate(@Req() req: AuthRequest, @Body() dto: BackupRegenerateDto) {
    return this.auth.regenerateBackupCodes(req.user.userId, dto.password);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthRequest) {
    return this.auth.getProfile(req.user.userId);
  }
}
