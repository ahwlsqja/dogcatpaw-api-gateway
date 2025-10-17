# 펫 등록 프론트엔드 가이드

## 개요
펫을 블록체인에 등록하고 VC(Verifiable Credential)를 발급받는 프로세스입니다.

## 보안 요구사항
- ✅ **보호자가 직접 서명** (vcSignature 필수)
- ✅ **비문 이미지 업로드** (ML 서버에서 feature vector 추출)
- ✅ **블록체인 트랜잭션 서명** (signedTx - 프로덕션에서만)

---

## 옵션 1: 한 번에 등록 (추천)

### Step 1: VC 서명 데이터 미리 받기

```typescript
// POST /pet/prepare-registration
const prepareResponse = await fetch('/pet/prepare-registration', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    petName: '멍멍이',
    species: 'dog',
    breed: 'GOLDEN_RETRIEVER',
    old: 3,
    gender: 'MAIL',
    weight: 25.5,
    color: '갈색',
    feature: '활발함',
    neutered: true
  })
});

const { vcSigningData } = await prepareResponse.json();
/*
{
  success: true,
  vcSigningData: {
    messageHash: "0x1234567890abcdef...",
    instruction: "Please sign this message to create Pet VC"
  }
}
*/
```

### Step 2: MetaMask 서명 받기

```typescript
// VC 발급 동의 서명
const vcSignature = await window.ethereum.request({
  method: 'personal_sign',
  params: [vcSigningData.messageHash, walletAddress]
});

console.log('VC Signature:', vcSignature);
// "0xabcdef1234567890..." (130자 hex string)
```

### Step 3: 펫 등록 (비문 이미지 + vcSignature)

```typescript
// FormData 생성 (multipart/form-data)
const formData = new FormData();

// 필수: 비문 이미지
formData.append('noseImage', noseImageFile);

// 필수: 펫 정보
formData.append('petName', '멍멍이');
formData.append('species', 'dog');

// 선택: 추가 정보
formData.append('breed', 'GOLDEN_RETRIEVER');
formData.append('old', '3');
formData.append('gender', 'MAIL');
formData.append('weight', '25.5');
formData.append('color', '갈색');
formData.append('feature', '활발함');
formData.append('neutered', 'true');

// 중요: VC 서명 (Step 2에서 받은 서명)
formData.append('vcSignature', vcSignature);

// 프로덕션: 블록체인 트랜잭션 서명
// formData.append('signedTx', signedTransaction);

// POST /pet/register
const response = await fetch('/pet/register', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
    // Content-Type은 자동 설정됨 (multipart/form-data)
  },
  body: formData
});

const result = await response.json();
/*
{
  success: true,
  petDID: "did:ethr:besu:0xabc123...",
  message: "Pet registered successfully. VC creation queued in background.",
  springJobId: "456",
  vcJobId: "789"
}
*/

console.log('펫 등록 완료!', result.petDID);
console.log('VC 생성 중... (백그라운드 처리)');
```

### Step 4: VC 생성 완료 확인 (선택사항)

```typescript
// 몇 초 후 VC 조회 가능
setTimeout(async () => {
  const vcResponse = await fetch(`/vc/pet/${result.petDID}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const vcData = await vcResponse.json();
  console.log('VC 생성 완료!', vcData);
}, 5000); // 5초 후
```

---

## 옵션 2: 서명 없이 등록 (나중에 VC 생성)

### Step 1: 펫 등록 (vcSignature 제외)

```typescript
const formData = new FormData();
formData.append('noseImage', noseImageFile);
formData.append('petName', '멍멍이');
formData.append('species', 'dog');
// vcSignature 없음!

const response = await fetch('/pet/register', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: formData
});

const result = await response.json();
/*
{
  success: true,
  petDID: "did:ethr:besu:0xabc123...",
  message: "Pet registered successfully. Please call POST /vc/prepare-vc-signing to create VC with your signature.",
  springJobId: "456"
  // vcJobId 없음
}
*/
```

### Step 2: 나중에 VC 생성

```typescript
// 1. VC 서명 데이터 받기
const prepareVCResponse = await fetch('/vc/prepare-vc-signing', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    petDID: result.petDID,
    biometricHash: '0xabc...', // 비문 해시
    petData: {
      petName: '멍멍이',
      species: 'dog',
      breed: 'GOLDEN_RETRIEVER'
    }
  })
});

const { messageHash } = await prepareVCResponse.json();

// 2. 서명
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [messageHash, walletAddress]
});

// 3. VC 생성
const createVCResponse = await fetch('/vc/create-vc-with-signature', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    signature,
    message: prepareVCResponse.message,
    petDID: result.petDID,
    petData: { ... }
  })
});

const vcResult = await createVCResponse.json();
console.log('VC 생성 완료!', vcResult);
```

---

## React 컴포넌트 예시

```tsx
// RegisterPetForm.tsx
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';

export default function RegisterPetForm() {
  const { walletAddress, accessToken } = useWallet();
  const [noseImage, setNoseImage] = useState<File | null>(null);
  const [petData, setPetData] = useState({
    petName: '',
    species: 'dog',
    breed: '',
    old: 0,
    gender: '',
    weight: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noseImage) {
      alert('비문 이미지를 업로드해주세요!');
      return;
    }

    setLoading(true);

    try {
      // Step 1: VC 서명 데이터 받기
      const prepareResponse = await fetch('/pet/prepare-registration', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(petData)
      });

      const { vcSigningData } = await prepareResponse.json();

      // Step 2: VC 서명
      const vcSignature = await window.ethereum.request({
        method: 'personal_sign',
        params: [vcSigningData.messageHash, walletAddress]
      });

      // Step 3: 펫 등록
      const formData = new FormData();
      formData.append('noseImage', noseImage);
      formData.append('vcSignature', vcSignature);

      Object.entries(petData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      const response = await fetch('/pet/register', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        alert(`펫 등록 완료! PetDID: ${result.petDID}`);
        // 리다이렉트 또는 다음 단계
      } else {
        alert(`등록 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('펫 등록 에러:', error);
      alert('펫 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        accept="image/jpeg,image/png"
        onChange={(e) => setNoseImage(e.target.files?.[0] || null)}
        required
      />

      <input
        type="text"
        placeholder="펫 이름"
        value={petData.petName}
        onChange={(e) => setPetData({ ...petData, petName: e.target.value })}
        required
      />

      <select
        value={petData.species}
        onChange={(e) => setPetData({ ...petData, species: e.target.value })}
        required
      >
        <option value="dog">강아지</option>
        <option value="cat">고양이</option>
      </select>

      {/* 기타 필드... */}

      <button type="submit" disabled={loading}>
        {loading ? '등록 중...' : '펫 등록하기'}
      </button>
    </form>
  );
}
```

---

## 에러 처리

### 1. 비문 이미지 오류

```typescript
// 응답
{
  statusCode: 400,
  message: "Invalid file type. Only JPEG and PNG are allowed"
}
```

**해결**: JPEG, PNG 파일만 업로드

### 2. 가디언 미등록

```typescript
// 응답
{
  success: false,
  error: "가디언이 등록되지 않았습니다. 먼저 등록해주세요!"
}
```

**해결**: POST /api/guardian/register 먼저 호출

### 3. VC 서명 누락

```typescript
// 응답
{
  success: true,
  message: "Pet registered successfully. Please call POST /vc/prepare-vc-signing to create VC with your signature.",
  // vcJobId 없음
}
```

**해결**: 나중에 수동으로 VC 생성 (옵션 2 참고)

---

## 주의사항

1. **vcSignature는 선택사항이지만 강력 권장**
   - 서명 없으면 VC가 자동 생성되지 않음
   - 나중에 수동으로 생성해야 함

2. **비문 이미지는 필수**
   - JPEG, PNG만 허용
   - 최대 10MB

3. **서명은 항상 사용자가 직접**
   - MetaMask 팝업으로 확인
   - 서버는 절대 대신 서명하지 않음

4. **VC 생성은 백그라운드 처리**
   - 즉시 완료되지 않을 수 있음
   - vcJobId로 나중에 상태 확인 가능
