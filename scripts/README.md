# E2E Testing Scripts

이 디렉토리에는 API Gateway와 gRPC 서비스, 블록체인을 직접 테스트할 수 있는 스크립트가 포함되어 있습니다.

## 📋 사전 준비

1. **API Gateway 실행**
   ```bash
   npm run start:dev
   ```

2. **필요한 서비스 확인**
   - Redis (Bull Queue 및 캐시용)
   - VC gRPC Service (이메일 인증 후 계정 등록용)
   - Blockchain (Guardian 등록용)

---

## 🔐 Web3 토큰 생성

### 새로운 지갑 생성
```bash
npm run token:generate
```

**출력 예시:**
```
============================================================
🔐 Web3 Wallet & Token Generator
============================================================
Wallet Address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
Private Key: 0x...

Web3 Token (valid for 7 days):
eyJhbGc...

============================================================
📋 Use in Postman Headers:
============================================================
Authorization: eyJhbGc...
walletaddress: 0x742d35cc6634c0532925a3b844bc454e4438f44e
```

### 기존 Private Key로 토큰 생성
```bash
node scripts/generate-web3-token.js 0xYOUR_PRIVATE_KEY
```

---

## 🐕 Guardian E2E 테스트

### DEV 모드 (인증 불필요, 빠른 테스트)
```bash
npm run test:guardian:dev
```

**특징:**
- Web3 서명 불필요
- 고정된 테스트 지갑 사용
- 빠르게 API 흐름 테스트 가능

### Production 모드 (실제 Web3 인증)
```bash
npm run test:guardian
```

**특징:**
- 실제 Web3 지갑 생성
- 트랜잭션 서명
- 실제 프로덕션 환경과 동일

---

## 📝 테스트 시나리오

`test-guardian-e2e.js` 스크립트는 다음 단계를 자동으로 테스트합니다:

### **STEP 0: 인증 설정**
- DEV 모드: 고정 지갑 사용
- Production 모드: Web3 지갑 및 토큰 생성

### **STEP 1: 이메일 인증 (필수 전제조건)**
1. `POST /email/send-code` - 인증 코드 발송
2. 콘솔에서 6자리 코드 입력 대기
3. `POST /email/verify-code` - 코드 검증

### **STEP 2: 등록 상태 확인**
- `GET /api/guardian/check/:address` - 이미 등록된 계정인지 확인

### **STEP 3: Guardian 등록**
- `POST /api/guardian/register` - 보호자 등록
  - 이메일, 이름, 전화번호 등 정보 전송
  - 블록체인에 트랜잭션 전송

### **STEP 4: 프로필 조회**
- `GET /api/guardian/profile/:address` - 등록된 프로필 확인

### **STEP 5: 검증 상태 조회**
- `GET /api/guardian/verification/:address` - 이메일/SMS 검증 상태

### **STEP 6: 펫 목록 조회**
- `GET /api/guardian/pets/:address` - 연결된 펫 목록

### **STEP 7: 전체 Guardian 수**
- `GET /api/guardian/total` - 시스템 전체 보호자 수

### **STEP 8 (옵션): 펫 연결**
- `POST /api/guardian/link-pet` - Pet DID와 Guardian 연결

---

## 🎨 출력 예시

```bash
$ npm run test:guardian:dev

🐕 PetDID Guardian E2E Test
API Base: http://localhost:3000
Dev Mode: YES

============================================================
[STEP 0] Setup Authentication
============================================================
🔧 Using DEV MODE - no Web3 token needed

============================================================
[STEP 1] Email Verification (Prerequisite)
============================================================
📧 Sending verification code to: test-1735678900123@example.com
{
  "success": true,
  "message": "인증 코드가 발송되었습니다!"
}
✅ Verification code sent! Check your email or logs.

📮 Enter the 6-digit verification code: 123456

{
  "success": true,
  "message": "이메일 검증이 완료되었습니다! (DEV MODE - VC 등록 스킵)"
}
✅ Email verified successfully!

============================================================
[STEP 2] Check Guardian Registration Status
============================================================
...
```

---

## 🛠️ 커스터마이징

### API Base URL 변경
```bash
API_BASE=http://localhost:4000 npm run test:guardian
```

### 스크립트 직접 수정
`scripts/test-guardian-e2e.js` 파일에서:
- 테스트 데이터 변경 (`guardianData` 객체)
- 추가 테스트 단계 작성
- 에러 핸들링 수정

---

## 📌 Postman 대신 사용하기

이 스크립트를 Postman Collection 대신 사용하면:

✅ **장점:**
- Git으로 버전 관리 가능
- 자동화된 E2E 플로우
- CI/CD 파이프라인에 통합 가능
- 팀원들과 동일한 테스트 환경 공유

❌ **단점:**
- 시각적 UI 없음
- 개별 API 단독 테스트 불편
- 디버깅이 약간 더 어려움

**추천:**
- 개발 초기 + 빠른 전체 플로우 테스트 → 이 스크립트 사용
- 개별 API 디버깅 + UI 필요 → Postman 사용

---

## 🔧 트러블슈팅

### Q: "ECONNREFUSED" 에러
**A:** API Gateway가 실행 중인지 확인하세요.
```bash
npm run start:dev
```

### Q: 이메일 코드를 못 받았어요
**A:**
1. 콘솔 로그 확인: `[EmailProcessor] 📨 SMTP send took XXms`
2. Redis 연결 확인
3. `EMAIL_USER`, `EMAIL_APP_PASSWORD` 환경 변수 확인

### Q: "계정 등록 중 에러가 발생했습니다" (gRPC)
**A:**
1. VC gRPC 서비스가 실행 중인지 확인
2. DEV 모드 사용: `npm run test:guardian:dev`
3. `email.controller.ts`에서 DEV 모드 스킵 로직 확인

### Q: Guardian 등록 실패
**A:**
1. 블록체인 노드가 실행 중인지 확인
2. 지갑에 충분한 가스비가 있는지 확인
3. 이미 등록된 계정인지 확인 (STEP 2 결과)

---

## 📚 추가 리소스

- [NestJS 공식 문서](https://docs.nestjs.com/)
- [Ethers.js 문서](https://docs.ethers.org/)
- [Web3-Token GitHub](https://github.com/bytesbay/web3-token)

---

**작성일:** 2025-10-11
**작성자:** Claude Code
