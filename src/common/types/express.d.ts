/**
 * 아하! 이전 프로젝트에서는 Passport.js를 사용했을 가능성이 높습니다. Passport는 자체적으로 req.user 타입을 정의해주기 때문에 별도
  타입 선언이 필요 없었습니다.

  현재 프로젝트는:
  - @nestjs/passport가 없음
  - @nestjs/jwt도 없음
  - 직접 Web3Token으로 인증 구현
 */



declare namespace Express {
  interface Request {
    user?: {
      address: string;
      walletAddress?: string;
      tokenBody?: any;
      // VP verification fields (One Session = One VP)
      vpVerified?: boolean;
      vpHolder?: string;
      vcCount?: number;
    };
  }
}
