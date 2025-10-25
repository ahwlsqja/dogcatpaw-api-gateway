// api-gateway/src/email/email.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { EmailService } from './email.service';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  SendVerificationCodeDto,
  SendVerificationCodeResponseDto
} from './dto/send-verification-code.dto';
import {
  VerifyEmailCodeDto,
  VerifyEmailCodeResponseDto
} from './dto/verify-email-code.dto';

@Controller('email')
@ApiBearerAuth('access-token')
@ApiTags('Email')
export class EmailController {

  constructor(
    private emailService: EmailService,
    private vcProxyService: VcProxyService,
  ) {}

  @Post('send-code')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({
    summary: 'Send Email Verification Code',
    description: `
**Send a 6-digit verification code to user's email**

This is the first step in the email verification process, required for guardian registration.

**Guardian Registration Flow:**
1. **Step 1 (This endpoint):** Send verification code to email
2. Step 2: User checks email for 6-digit code
3. Step 3: User submits code via POST /email/verify-code
4. Step 4: System verifies email and registers account in VC service

**Important:**
- User must be authenticated (JWT token required)
- Verification code expires after 10 minutes
- Only one active code per wallet address at a time
- Sending a new code invalidates the previous one
- Maximum 5 attempts per hour to prevent spam

**Code Delivery:**
- Email subject: "DogCatPaw - Email Verification Code"
- Code format: 6 numeric digits (e.g., 123456)
- Valid for: 10 minutes
- Sender: noreply@dogcatpaw.com (or configured sender)

**Use Cases:**
- Guardian registration email verification
- Email change verification (future)
- Account recovery (future)

**Rate Limiting:**
- Maximum 5 code requests per wallet address per hour
- Cooldown period: 60 seconds between requests

**Example Flow:**
\`\`\`javascript
// Step 1: Request verification code
const response = await fetch('/email/send-code', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: 'user@example.com' })
});

// Step 2: User receives email and enters code
// Step 3: Verify code (see POST /email/verify-code)
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
    type: SendVerificationCodeResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid email format or rate limit exceeded',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
  })
  async sendCode(
    @Body() dto: SendVerificationCodeDto,
    @Req() req: Request
  ): Promise<SendVerificationCodeResponseDto> {
    const walletAddress = req.user.address;
    return this.emailService.sendVerificationCode(walletAddress, dto.email);
  }

  @Post('verify-code')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({
    summary: 'Verify Email Code and Register Account',
    description: `
**Verify the 6-digit email code and complete account registration**

This is the final step in the email verification process. Upon successful verification:
1. Email is marked as verified
2. Account is registered in VC service (via gRPC)
3. User can proceed with guardian registration

**Verification Process:**
1. User submits the 6-digit code received via email
2. System validates code against stored hash
3. System checks code expiration (10 minutes)
4. If valid, registers account in VC service
5. Returns success with account registration confirmation

**Code Validation:**
- Code must be exactly 6 digits
- Code must not be expired (10 minutes validity)
- Code must match the one sent to the wallet address
- Maximum 3 verification attempts before code is invalidated

**Failed Attempts:**
- Remaining attempts are returned in response
- After 3 failed attempts, user must request a new code
- Failed attempts are tracked per wallet address

**Account Registration:**
- On successful verification, account is registered in VC service
- Registration creates user record with wallet address
- Email is stored as verified
- If registration fails, email is still marked as verified

**Next Steps After Success:**
1. Email verified ✅
2. Account registered in VC service ✅
3. User can now proceed to guardian registration (POST /api/guardian/register)

**Example Flow:**
\`\`\`javascript
// After receiving code via email
const response = await fetch('/email/verify-code', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ code: '123456' })
});

if (response.success) {
  // Email verified, proceed to guardian registration
  console.log('Email verified! Proceeding to guardian registration...');
}
\`\`\`

**Error Handling:**
- Invalid code: Returns error with remaining attempts
- Expired code: User must request new code
- No code found: User must request code first
- Account registration fails: Email still verified, warning returned
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified and account registered successfully',
    type: VerifyEmailCodeResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid code format, expired code, or verification failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async verifyCode(
    @Body() dto: VerifyEmailCodeDto,
    @Req() req: Request
  ): Promise<VerifyEmailCodeResponseDto> {
    const walletAddress = req.user.address;

    // 1. 코드 검증
    const result = await this.emailService.verifyCode(walletAddress, dto.code);

    if (!result.success) {
      return result;
    }

    // 2. VC Service에 Auth 등록 (gRPC)
    try {
      const authResult = await this.vcProxyService.registerAuth({ walletAddress });

      return {
        success: true,
        message: '이메일 검증이 완료되었고 계정이 등록되었습니다!',
      };
    } catch (error) {
      console.error('계정 등록 중 에러가 발생했습니다!:', error);
      return {
        success: true, // 이메일 인증은 성공
        warning: '이메일 검증은 성공이 성공했습니다!',
      };
    }
  }
}