# Spring Backend API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Authentication API](#1-authentication-api)
  - [Pet Profile API](#2-pet-profile-api)
  - [VC Sync API](#3-vc-sync-api)
  - [Adoption Post API](#4-adoption-post-api)
  - [Daily Story API](#5-daily-story-api)
  - [Adoption Review Story API](#6-adoption-review-story-api)
  - [Like and Comment API](#7-like-and-comment-api)
  - [Chat Room API](#8-chat-room-api)
  - [Donation Management API](#9-donation-management-api)
- [Integration with API Gateway](#integration-with-api-gateway)
  - [Spring Module](#spring-module)
  - [Guardian Module](#guardian-module)
  - [Pet Module](#pet-module)
- [Data Models](#data-models)

---

## Overview

**Service Name:** 멍냥일지 (Dog-Cat Diary)
**Description:** Pet adoption and welfare platform with social features, donation management, and verifiable credentials integration
**OpenAPI Version:** 3.0.1
**Base URL:** `http://petdid-netw-spring-api-s-63e64-109009070-a2991555908e.kr.lb.naverncp.com`

### Statistics
- **Total Endpoints:** 35
- **Total Data Schemas:** 77
- **API Controllers:** 9

---

## Authentication

**Type:** HTTP Bearer Authentication
**Scheme:** Bearer
**Format:** JWT

### Headers
```
Authorization: Bearer {access_token}
```

All authenticated endpoints require a valid JWT token obtained from the login endpoint.

---

## API Endpoints

### 1. Authentication API
**Tag:** 사용자인증 Swagger API
**Purpose:** User authentication and authorization

#### POST /api/auth/signup
**Summary:** Sign up (회원가입)

**Request Body:**
```json
{
  "walletAddress": "string",
  "username": "string",
  "nickname": "string",
  "gender": "string",
  "old": 0,
  "address": "string",
  "phoneNumber": "string",
  "type": "string",
  "email": "string"
}
```

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "id": 0,
    "walletAddress": "string",
    "nickname": "string"
  }
}
```

---

#### POST /api/auth/login
**Summary:** Login (로그인)

**Request Body:**
```json
{
  "walletAddress": "string"
}
```

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "id": 0,
    "nickname": "string",
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

---

#### POST /api/auth/logout
**Summary:** Logout (로그아웃)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {}
}
```

---

#### POST /api/auth/reissue
**Summary:** Token reissue (재발급)
**Description:** Reissue access token using refresh token

**Request Body:**
```json
{
  "id": 0,
  "refreshToken": "string"
}
```

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "id": 0,
    "nickname": "string",
    "accessToken": "string"
  }
}
```

---

### 2. Pet Profile API
**Tag:** 반려동물 API
**Purpose:** Pet profile management

#### GET /api/pet
**Summary:** Get my pet list (내 반려동물 조회)
**Authentication:** Required

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": [
    {
      "petId": 0,
      "did": "string",
      "petProfile": "string",
      "petName": "string",
      "old": 0,
      "weight": 0,
      "gender": "string",
      "breed": "string",
      "color": "string",
      "specifics": "string",
      "neutral": true
    }
  ]
}
```

---

#### POST /api/pet
**Summary:** Register pet (반려동물 등록)
**Authentication:** Required

**Request Body:**
```json
{
  "did": "string",
  "petProfile": "string",
  "petName": "string",
  "breed": "string",
  "old": 0,
  "weight": 0,
  "gender": "string",
  "color": "string",
  "feature": "string",
  "specifics": "string",
  "neutral": true
}
```

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "memberId": 0,
    "petId": 0,
    "did": "string",
    "petName": "string"
  }
}
```

---

### 3. VC Sync API
**Tag:** VC 연동 API
**Purpose:** Verifiable Credentials synchronization

#### POST /api/vc/sync
**Summary:** VC JWT sync
**Description:** Get vcJwt from Guardian service and sync pet data

**Request Body:**
```json
{
  "memberWallet": "string",
  "vcJwt": ["string", "string"]
}
```

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": [
    {
      "petName": "string",
      "breed": "string",
      "old": 0,
      "weight": 0,
      "gender": "string",
      "color": "string",
      "specifics": "string",
      "issuer": "string",
      "neutral": true,
      "did": "string"
    }
  ]
}
```

---

### 4. Adoption Post API
**Tag:** 입양 게시 API
**Purpose:** Pet adoption posts and listings

#### GET /api/adoption/
**Summary:** Get adoption posts (cursor-based) (입양 게시 조회)

**Query Parameters:**
- `cursor` (integer, optional) - Pagination cursor
- `size` (integer, optional) - Page size (default: 9)
- `status` (string, optional) - Filter by status
- `breed` (string, optional) - Filter by breed
- `region` (string, optional) - Filter by region
- `district` (string, optional) - Filter by district

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "donations": [
      {
        "thumbnail": "string",
        "title": "string",
        "currentAmount": 0,
        "targetAmount": 0,
        "donationStatus": "string",
        "patronCount": 0,
        "progress": 0,
        "dday": "string"
      }
    ],
    "nextCursor": 0
  }
}
```

---

#### GET /api/adoption/detail
**Summary:** Get adoption post detail (입양 게시 글 상세보기 조회)

**Query Parameters:**
- `adoptId` (integer, **required**) - Adoption post ID

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "memberId": 0,
    "petName": "string",
    "breed": "string",
    "title": "string",
    "content": "string",
    "region": "string",
    "district": "string",
    "shelterName": "string",
    "contact": "string",
    "deadline": "string",
    "status": "string"
  }
}
```

---

#### GET /api/adoption/home
**Summary:** Get home screen (홈 화면 조회)
**Description:** Retrieve adoption posts, donations, daily stories, and reviews (3 each)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "latestAdoptions": [],
    "closingSoonDonations": [],
    "popularReviews": [],
    "popularStories": []
  }
}
```

---

#### POST /api/adoption/post
**Summary:** Create adoption post (입양 게시 작성)
**Authentication:** Required

**Request Body:**
```json
{
  "petId": 0,
  "title": "string",
  "content": "string",
  "region": "string",
  "district": "string",
  "shelterName": "string",
  "contact": "string",
  "deadLine": "string",
  "status": "string"
}
```

---

### 5. Daily Story API
**Tag:** 일상 글쓰기 API
**Purpose:** Daily pet stories

#### POST /api/story/daily
**Summary:** Create daily story (일상 글쓰기 작성)
**Authentication:** Required
**Content-Type:** multipart/form-data

**Request Body:**
- `story` (object):
  ```json
  {
    "petId": 0,
    "title": "string",
    "content": "string"
  }
  ```
- `image` (file)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "memberName": "string",
    "storyId": 0,
    "petId": 0,
    "title": "string",
    "images": "string",
    "content": "string",
    "did": "string"
  }
}
```

---

#### GET /api/story/daily/stories
**Summary:** Get all daily stories (최신 일상 글쓰기 전체 조회)

**Query Parameters:**
- `cursorId` (integer, optional)
- `size` (integer, optional)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "stories": [],
    "nextCursor": 0
  }
}
```

---

#### GET /api/story/daily/{stories}
**Summary:** Get single daily story (일상 글쓰기 하나 조회)

**Path Parameters:**
- `stories` (integer, **required**) - Story ID

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "profileUrl": "string",
    "memberName": "string",
    "petId": 0,
    "title": "string",
    "images": "string",
    "content": "string",
    "breed": "string",
    "petName": "string",
    "likeCount": 0,
    "liked": false,
    "commentCount": 0,
    "createdAt": "string",
    "did": "string"
  }
}
```

---

#### GET /api/story/daily/search
**Summary:** Search daily stories (일상 글쓰기 검색하기)
**Authentication:** Required

**Query Parameters:**
- `keyword` (string, **required**)
- `cursorId` (integer, optional)
- `size` (integer, optional)

---

### 6. Adoption Review Story API
**Tag:** 입양 후기 게시 API
**Purpose:** Post-adoption reviews

#### POST /api/story/review
**Summary:** Create adoption review (입양 후기 게시 작성)
**Authentication:** Required
**Content-Type:** multipart/form-data

**Request Body:**
- `story` (object):
  ```json
  {
    "petId": 0,
    "title": "string",
    "content": "string",
    "adoptionAgency": "string",
    "adoptionDate": "string"
  }
  ```
- `image` (file)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "memberName": "string",
    "storyId": 0,
    "petId": 0
  }
}
```

---

#### GET /api/story/review/reviews
**Summary:** Get all adoption reviews (최신 입양 후기 전체 조회)

**Query Parameters:**
- `cursorId` (integer, optional)
- `size` (integer, optional)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "reviews": [],
    "nextCursor": 0
  }
}
```

---

#### GET /api/story/review/{reviews}
**Summary:** Get single adoption review (입양 후기 글 조회)

**Path Parameters:**
- `reviews` (integer, **required**) - Review ID

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "profileUrl": "string",
    "memberName": "string",
    "petId": 0,
    "title": "string",
    "images": "string",
    "content": "string",
    "breed": "string",
    "petName": "string",
    "likeCount": 0,
    "liked": false,
    "commentCount": 0,
    "adoptionAgency": "string",
    "adoptionDate": "string",
    "createdAt": "string",
    "did": "string"
  }
}
```

---

#### GET /api/story/review/search
**Summary:** Search adoption reviews (입양 후기 검색하기)
**Authentication:** Required

**Query Parameters:**
- `keyword` (string, **required**)
- `cursorId` (integer, optional)
- `size` (integer, optional)

---

### 7. Like and Comment API
**Tag:** 게시 좋아요, 댓글 관리 API
**Purpose:** Social interactions for posts

#### POST /api/like/
**Summary:** Toggle like (좋아요 토글)
**Authentication:** Required

**Query Parameters:**
- `storyId` (integer, **required**)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "storyId": 0,
    "memberId": 0,
    "likeCount": 0,
    "liked": true
  }
}
```

---

#### GET /api/comment/
**Summary:** Get comments (댓글 조회)

**Query Parameters:**
- `storyId` (integer, **required**)
- `cursor` (integer, optional)
- `size` (integer, optional)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "commentList": [
      {
        "nickName": "string",
        "storyId": 0,
        "commentId": 0,
        "savedComment": "string",
        "createdAt": "string"
      }
    ],
    "nextCursor": 0
  }
}
```

---

#### POST /api/comment/
**Summary:** Write comment (댓글 작성)
**Authentication:** Required

**Request Body:**
```json
{
  "storyId": 0,
  "comment": "string"
}
```

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "memberId": 0,
    "commentId": 0,
    "savedComment": "string"
  }
}
```

---

### 8. Chat Room API
**Tag:** 채팅 관리 API
**Purpose:** Chat functionality for adoption inquiries

#### POST /api/chat/room/create
**Summary:** Create chat room (채팅방 만들기)
**Authentication:** Required

**Request Body:**
```json
{
  "adoptWriterId": 0,
  "adoptId": 0,
  "roomName": "string"
}
```

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "roomId": 0,
    "roomName": "string"
  }
}
```

---

#### GET /api/chat/room/list
**Summary:** Get chat room list (채팅방 전체 조회)
**Authentication:** Required

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": [
    {
      "roomId": 0,
      "roomName": "string",
      "userName": "string",
      "message": "string",
      "unreadCount": 0
    }
  ]
}
```

---

#### GET /api/chat/room/card
**Summary:** Get chat room card info (채팅방 카드 정보 조회)
**Authentication:** Required

**Query Parameters:**
- `roomId` (integer, **required**)

---

#### POST /api/chat/{roomId}/enter
**Summary:** Enter chat room and get messages (채팅방 입장 및 메시지 조회하기)
**Authentication:** Required

**Path Parameters:**
- `roomId` (integer, **required**)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": [
    {
      "adoptId": 0,
      "messageId": 0,
      "senderId": 0,
      "senderName": "string",
      "message": "string",
      "read": false
    }
  ]
}
```

---

#### GET /api/chat/room/{roomId}/adoption
**Summary:** Get adoption info for chat (채팅방 연결 입양 게시 조회)
**Authentication:** Required

**Path Parameters:**
- `roomId` (integer, **required**)

---

### 9. Donation Management API
**Tag:** 후원 관리 API
**Purpose:** Pet donation and fundraising

#### POST /api/donation/posts
**Summary:** Create donation post (후원 게시 글 작성하기)
**Authentication:** Required

**Request Body:**
```json
{
  "memberId": 0,
  "petId": 0,
  "title": "string",
  "targetAmount": 0,
  "deadline": "string",
  "category": "string",
  "content": "string",
  "images": "string",
  "bankName": "string",
  "accountNumber": "string",
  "accountHolder": "string"
}
```

---

#### GET /api/donation/list
**Summary:** Get all donation list (cursor-based) (폴더 - 전체 후원 리스트)

**Query Parameters:**
- `cursor` (integer, optional)
- `size` (integer, optional, default: 9)
- `breed` (string, optional)
- `status` (string, optional) - ACTIVE, ACHIEVED, CLOSED

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "donations": [],
    "nextCursor": 0
  }
}
```

---

#### GET /api/donation/closing
**Summary:** Get closing soon donations (홈화면 - 마감 임박 후원 3개)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": []
}
```

---

#### GET /api/donation/
**Summary:** Get donation detail + donation history (후원 게시 글 및 정보 + 후원 내역 조회)

**Query Parameters:**
- `donationId` (integer, **required**)
- `cursor` (integer, optional)
- `size` (integer, optional)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "memberId": 0,
    "petName": "string",
    "petDid": "string",
    "breed": "string",
    "title": "string",
    "targetAmount": 0,
    "currentAmount": 0,
    "donationStatus": "string",
    "deadline": "string",
    "category": "string",
    "content": "string",
    "images": "string",
    "patronCount": 0,
    "progress": 0,
    "recentDonations": [
      {
        "nickname": "string",
        "profileUrl": "string",
        "donationAmount": 0,
        "donationTime": "string"
      }
    ],
    "cursor": 0,
    "dday": "string"
  }
}
```

---

#### POST /api/donations
**Summary:** Make donation (후원하기)
**Authentication:** Required

**Request Body:**
```json
{
  "memberId": 0,
  "itemId": 0,
  "donationId": 0
}
```

---

#### GET /api/donations/mine
**Summary:** Get my donation history (paginated) (나의 후원내역 내역 조회하기)
**Authentication:** Required

**Query Parameters:**
- `cursor` (integer, optional)
- `size` (integer, optional)

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "totalAmount": 0,
    "currentBoneBalance": 0,
    "donations": [
      {
        "donationTitle": "string",
        "donationAmount": 0,
        "donationTime": "string"
      }
    ],
    "cursor": 0
  }
}
```

---

#### GET /api/donations/bone
**Summary:** Get my bone balance (나의 후원 가능한 뼈다귀 조회)
**Authentication:** Required

**Response 200:**
```json
{
  "isSuccess": true,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": {
    "currentBoneBalance": 0
  }
}
```

---

#### POST /api/payment/prepare
**Summary:** Prepare payment (뼈다귀 충전 준비)
**Authentication:** Required

**Request Body:**
```json
{
  "itemId": 0
}
```

---

#### POST /api/payment/approve
**Summary:** Approve payment (뼈다귀 서비스 승인)
**Authentication:** Required

**Request Body:**
```json
{
  "orderId": "string",
  "paymentKey": "string",
  "finalAmount": 0
}
```

---

## Integration with API Gateway

The API Gateway (DogCatPaw API Gateway) integrates with the Spring backend through three main modules:

### Spring Module

**Location:** `src/spring/`

#### SpringController (`spring.controller.ts`)

**Base Path:** `/api/spring`
**Tag:** Spring Integration

##### Endpoints:

1. **POST /api/spring/sync-me**
   - **Summary:** Sync my data to Spring server (async)
   - **Authentication:** Required (DIDAuthGuard)
   - **Description:** Queue user sync after guardian registration
   - **Response:**
     ```json
     {
       "success": true,
       "jobId": "string",
       "message": "User sync queued. Check status with job ID",
       "statusEndpoint": "/api/spring/job-status/{jobId}"
     }
     ```

2. **POST /api/spring/update-me**
   - **Summary:** Update my data in Spring server (async)
   - **Authentication:** Required (DIDAuthGuard)
   - **Description:** Queue user update with latest data
   - **Response:**
     ```json
     {
       "success": true,
       "jobId": "string",
       "message": "User update queued"
     }
     ```

3. **POST /api/spring/notify-transfer**
   - **Summary:** Notify Spring about pet ownership transfer
   - **Authentication:** Required (DIDAuthGuard)
   - **Request Body:**
     ```json
     {
       "petDID": "string",
       "previousOwner": "string",
       "newOwner": "string"
     }
     ```
   - **Response:**
     ```json
     {
       "success": true,
       "jobId": "string",
       "message": "Transfer notification queued for Spring"
     }
     ```

4. **POST /api/spring/force-sync**
   - **Summary:** Force immediate sync with Spring (not recommended)
   - **Authentication:** Required (DIDAuthGuard)
   - **Description:** Direct sync (not queued) - use only when immediate response needed

5. **POST /api/spring/send-notification**
   - **Summary:** Send custom notification to Spring
   - **Authentication:** Required (DIDAuthGuard)
   - **Request Body:**
     ```json
     {
       "type": "string",
       "data": {}
     }
     ```

#### SpringService (`spring.service.ts`)

**Key Methods:**

- **queueUserSync(walletAddress, action, guardianInfo?, petInfo?)** - Queue user sync with priority
  - Actions: 'register' | 'update' | 'delete'
  - Priority: register=1, update=2

- **queueTransferNotification(petDID, previousOwner, newOwner)** - Queue pet ownership transfer

- **queueVPDelivery(walletAddress, vpJwt, purpose, targetEndpoint?)** - Queue Verifiable Presentation delivery

- **queuePetRegistration(guardianAddress, petDID, petData)** - Queue pet registration

- **directSyncUser(walletAddress, userData)** - Direct HTTP call to Spring (immediate)
  - Endpoint: `POST {SPRING_SERVER_URL}/api/users/sync-did-user`
  - Headers: `X-API-Gateway: dogcatpaw`

- **getUserFromSpring(walletAddress)** - Get user data from Spring
  - Endpoint: `GET {SPRING_SERVER_URL}/api/users/by-wallet/{walletAddress}`

- **sendNotification(type, data)** - Send notification to Spring
  - Endpoint: `POST {SPRING_SERVER_URL}/api/notifications`

**Queue Configuration:**
- Name: `spring-sync`
- Retry attempts: 3
- Backoff: exponential, 2000ms delay
- removeOnComplete: true
- removeOnFail: false

---

### Guardian Module

**Location:** `src/guardian/`

#### GuardianController (`guardian.controller.ts`)

**Base Path:** `/api/guardian`
**Tag:** Guardian

##### Endpoint:

**POST /api/guardian/register**
- **Summary:** 보호자 등록 - 이메일 인증 완료 후
- **Authentication:** Required (DIDAuthGuard)
- **Request Body:**
  ```json
  {
    "email": "string (required)",
    "phone": "string",
    "name": "string",
    "verificationMethod": 2,
    "signedTx": "string (optional, for production)"
  }
  ```
- **Process Flow:**
  1. Check email authentication via VC Service
  2. Validate email is provided
  3. Register guardian on blockchain
  4. Update guardian info in VC Service
  5. Queue sync to Spring server
- **Response:**
  ```json
  {
    "success": true,
    "guardianId": 0,
    "authId": 0,
    "txHash": "string",
    "springJobId": "string",
    "message": "Guardian registered successfully. Spring sync queued."
  }
  ```

#### GuardianService (`guardian.service.ts`)

**Smart Contract Integration:**
- **Contract:** GuardianRegistry
- **Network:** Besu (private)
- **Gas:** 0 (private network)

**Key Methods:**

- **registerGuardian(guardianAddress, personalDataHash, ncpStorageURI, verificationMethod, signedTx?)** - Register guardian on blockchain
  - Development mode: Uses admin key
  - Production mode: Requires signed transaction

- **verifyGuardian(guardianAddress, smsVerified, emailVerified)** - Verify guardian (requires VERIFIER_ROLE)

- **updateGuardianData(guardianAddress, newPersonalDataHash, newNcpStorageURI, signedTx?)** - Update guardian data

- **linkPet(guardianAddress, petDID, signedTx?)** - Link pet to guardian

- **unlinkPet(guardianAddress, petDID, signedTx?)** - Unlink pet from guardian

- **getGuardianProfile(guardianAddress)** - Get guardian profile (read-only)
  - Returns: guardianAddress, personalDataHash, ncpStorageURI, verificationMethod, verificationLevel, registeredAt, lastUpdated, isActive

- **getGuardianPets(guardianAddress)** - Get guardian's pets (read-only)

- **getVerificationProof(guardianAddress)** - Get verification proof (read-only)
  - Returns: smsVerified, emailVerified, timestamps, verifier

- **getTotalGuardians()** - Get total guardian count

- **isGuardianRegistered(guardianAddress)** - Check if guardian is registered

---

### Pet Module

**Location:** `src/pet/`

#### PetController (`pet.controller.ts`)

**Base Path:** `/pet`
**Tag:** Pet

##### Endpoints:

1. **POST /pet/register**
   - **Summary:** PetDID 등록 - 보호자만 가능 (비문 이미지 필수)
   - **Authentication:** Required (DIDAuthGuard)
   - **Content-Type:** multipart/form-data
   - **Request:**
     - Body: CreatePetDto
     - File: noseImage (JPEG/PNG, max 10MB)
   - **Process Flow:**
     1. Verify guardian is registered
     2. Extract nose vector from ML server
     3. Generate PetDID from feature vector hash
     4. Register PetDID on blockchain
     5. Save feature vector to S3
     6. Queue guardian link (async)
     7. Queue pet registration to Spring (async)
   - **Response:**
     ```json
     {
       "success": true,
       "petDID": "did:ethr:besu:{hash}",
       "message": "Pet registered successfully. IMPORTANT: Save featureVector and pass it to POST /vc/prepare-vc-signing",
       "springJobId": "string"
     }
     ```

2. **POST /pet/prepare-transfer/:petDID**
   - **Summary:** 펫 소유권 이전을 위한 서명 데이터 준비
   - **Authentication:** Required (DIDAuthGuard)
   - **Description:** Step 1: Prepare transfer (current guardian)
   - **Request Body:**
     ```json
     {
       "newGuardianAddress": "string",
       "petData": {
         "petName": "string",
         "breed": "string",
         "old": 0,
         "weight": 0,
         "gender": "string",
         "color": "string",
         "feature": "string",
         "neutered": false,
         "species": "string"
       }
     }
     ```
   - **Response:**
     ```json
     {
       "success": true,
       "nextStep": "New guardian must sign and call POST /pet/accept-transfer/:petDID"
     }
     ```

3. **POST /pet/verify-transfer/:petDID**
   - **Summary:** 소유권 이전 시 새 보호자 비문 검증
   - **Authentication:** Required (DIDAuthGuard)
   - **Description:** Step 2: Biometric verification (new guardian)
   - **Process:**
     1. Save noseprint to permanent storage
     2. Compare with stored image via ML server
     3. Verify similarity >= 80%
     4. Queue blockchain verification (async)
     5. Generate verification proof
   - **Response:**
     ```json
     {
       "success": true,
       "similarity": 85,
       "message": "비문 검증 성공! 이제 소유권 이전을 완료할 수 있습니다.",
       "verificationProof": {},
       "proofHash": "string",
       "nextStep": "Call POST /pet/accept-transfer/:petDID with signature and this proof"
     }
     ```

4. **POST /pet/accept-transfer/:petDID**
   - **Summary:** 펫 소유권 이전 수락 (새 보호자)
   - **Authentication:** Required (DIDAuthGuard)
   - **Description:** Step 3: Accept transfer with signature and proof
   - **Request Body:**
     ```json
     {
       "signature": "string",
       "message": {},
       "petData": {},
       "verificationProof": {},
       "signedTx": "string (optional)"
     }
     ```
   - **Process:**
     1. Verify new guardian matches message
     2. Verify biometric proof (valid within 10 minutes)
     3. Change controller on blockchain (critical)
     4. Queue guardian transfer sync (async)
     5. Queue VC transfer processing (async)
   - **Response:**
     ```json
     {
       "success": true,
       "txHash": "string",
       "blockNumber": 0,
       "similarity": 85,
       "vcTransferJobId": "string",
       "message": "Pet ownership transferred successfully on blockchain. VC processing queued."
     }
     ```

5. **POST /pet/verify-biometric/:petDID**
   - **Summary:** 비문 검증
   - **Request Body:**
     ```json
     {
       "similarity": 0,
       "purpose": 0,
       "modelServerSignature": "string"
     }
     ```

6. **GET /pet/history/:petDID**
   - **Summary:** 펫 소유권 이전 히스토리 (입양 기록) 조회
   - **Public:** Yes (no authentication required)
   - **Description:** Uses blockchain-indexer service with fallback to blockchain
   - **Response:**
     ```json
     {
       "success": true,
       "petDID": "string",
       "currentController": "string",
       "totalTransfers": 0,
       "history": [
         {
           "previousController": "string",
           "newController": "string",
           "blockNumber": 0,
           "transactionHash": "string",
           "timestamp": 0,
           "timestampISO": "string",
           "transferIndex": 0
         }
       ],
       "source": "blockchain-indexer"
     }
     ```

#### PetService (`pet.service.ts`)

**Smart Contract Integration:**
- **Contract:** PetDIDRegistry
- **Network:** Besu (private)
- **Gas:** 0 (private network)

**Key Methods:**

- **registerPetDID(petDID, featureVectorHash, modelServerReference, sampleCount, species, metadataURI, signedTx?)** - Register PetDID on blockchain

- **verifyBiometric(petDID, similarity, purpose, modelServerSignature)** - Verify biometric

- **verifyBiometricWithAdminSignature(petDID, similarity, purpose)** - Verify biometric with admin signature (development)

- **changeController(petDID, newController, signedTx?)** - Change pet controller (ownership transfer)

- **getDIDDocument(petDID)** - Get DID document (read-only)
  - Returns: biometricOwner, controller, created, updated, exists

- **getBiometricData(petDID)** - Get biometric data (read-only)
  - Returns: featureVectorHash, modelServerReference, sampleCount, registrationTime

- **getPetsByController(controller)** - Get pets by controller

- **getTotalPets()** - Get total pet count

- **registerCredential(credentialHash, credentialType, subject, expirationDate, signedTx?)** - Register credential

- **revokeCredential(credentialHash, signedTx?)** - Revoke credential

- **isCredentialValid(credentialHash)** - Check credential validity

- **isPetRegistered(petDID)** - Check if pet is registered

- **getPetControllerHistory(petDID)** - Get pet ownership history from blockchain events
  - Queries: DIDCreated and ControllerChanged events
  - Returns full history with timestamps

- **getVerificationHistory(petDID)** - Get verification history
  - Returns: verifier, timestamp, similarity, purpose

- **isAuthorizedGuardian(petDID, guardianAddress)** - Check if address is authorized guardian

**Biometric Verification Purposes:**
- 0: general_verification
- 1: emergency_access
- 2: ownership_transfer
- 3: medical_record
- 4: shelter_intake

---

## Data Models

### Common Response Structure
All Spring API responses follow this wrapper:
```json
{
  "isSuccess": boolean,
  "status": "string",
  "code": "string",
  "message": "string",
  "result": <actual_data>
}
```

### Pagination
Cursor-based pagination:
- **Request:** `cursor` (integer), `size` (integer)
- **Response:** Contains `nextCursor` field

### Key Data Types

#### Pet Data
```typescript
{
  petName?: string;
  breed?: string;
  old?: number;
  weight?: number;
  gender?: string;
  color?: string;
  feature?: string;
  neutered?: boolean;
  species: string;
}
```

#### DID Format
- Guardian DID: `did:ethr:besu:{walletAddress}`
- Pet DID: `did:ethr:besu:{featureVectorHash}`

#### Donation Status
- ACTIVE - Currently accepting donations
- ACHIEVED - Target amount reached
- CLOSED - Deadline passed or manually closed

#### Biometric Verification
- Threshold: 80% similarity
- Valid window: 10 minutes for transfer proof

---

## Architecture Notes

### Asynchronous Processing
The API Gateway uses **BullMQ** for asynchronous job processing:

1. **Spring Sync Queue** (`spring-sync`)
   - User sync (register/update)
   - Pet registration
   - Transfer notifications
   - VP delivery
   - Retry: 3 attempts with exponential backoff

2. **Blockchain Queue**
   - Guardian linking
   - Biometric verification recording
   - Transfer synchronization

3. **VC Queue**
   - VC transfer processing
   - Credential invalidation/creation

### Fire-and-Forget Pattern
Critical operations (blockchain transactions) are executed immediately, while:
- Spring sync is queued (async)
- VC processing is queued (async)
- Guardian linking is queued (async)

This ensures fast response times and resilience.

### Authentication Flow
1. User signs up with wallet address
2. Login returns JWT access token + refresh token
3. All authenticated endpoints require `Authorization: Bearer {token}`
4. Tokens can be refreshed via `/api/auth/reissue`

### DID & VC Integration
- **DID Authentication:** Uses DIDAuthGuard for wallet-based auth
- **VC Sync:** Spring backend syncs pet data via VC JWT
- **Verifiable Presentations:** Can be delivered to Spring via queue

### External Service Integration
- **ML Server:** Nose vector extraction and comparison
- **Blockchain Indexer:** Fast historical data queries with blockchain fallback
- **NCP Object Storage:** Feature vector and noseprint image storage
- **Spring Backend:** User/pet profile management and social features

---

## Error Handling

### Gateway Errors
```json
{
  "success": false,
  "error": "Error message",
  "requiresSignature": true,  // For unsigned transactions
  "transactionData": {}  // Transaction data to sign
}
```

### Spring API Errors
```json
{
  "isSuccess": false,
  "status": "error_code",
  "code": "ERROR_CODE",
  "message": "Error description",
  "result": null
}
```

---

## Environment Configuration

**Required Environment Variables:**
- `SPRING_SERVER_URL` - Spring backend URL
- `RPC_URL` - Blockchain RPC endpoint
- `ADMIN_PRIVATE_KEY` - Admin wallet private key (development)
- `GUARDIAN_REGISTRY_ADDRESS` - Guardian contract address
- `PET_DID_REGISTRY_ADDRESS` - Pet DID contract address
- `NODE_ENV` - Environment (development/production)
- `DIDMETHOD` - DID method (default: ethr)
- `DIDNETWORK` - DID network (default: besu)

---

## Integration Examples

### 1. Guardian Registration Flow
```
Frontend → API Gateway POST /api/guardian/register
         ↓
         1. Verify email authentication (VC Service)
         2. Hash personal data
         3. Register on blockchain (GuardianRegistry)
         4. Update guardian info (VC Service)
         5. Queue Spring sync (async)
         ↓
         → Returns: guardianId, txHash, springJobId
```

### 2. Pet Registration Flow
```
Frontend → API Gateway POST /pet/register + noseImage
         ↓
         1. Verify guardian registered
         2. Extract nose vector (ML Server)
         3. Generate PetDID
         4. Register on blockchain (PetDIDRegistry)
         5. Save vector to S3
         6. Queue guardian link (async)
         7. Queue Spring sync (async)
         ↓
         → Returns: petDID, springJobId
```

### 3. Pet Ownership Transfer Flow
```
Step 1: Current Guardian
Frontend → POST /pet/prepare-transfer/:petDID
         → Returns: signing data

Step 2: New Guardian (Biometric)
Frontend → POST /pet/verify-transfer/:petDID + nose image
         ↓
         1. Upload to storage
         2. Compare with ML Server
         3. Verify >= 80% similarity
         4. Queue blockchain record (async)
         ↓
         → Returns: verificationProof

Step 3: New Guardian (Accept)
Frontend → POST /pet/accept-transfer/:petDID + signature + proof
         ↓
         1. Verify proof (< 10 min old)
         2. Change controller on blockchain
         3. Queue guardian sync (async)
         4. Queue VC transfer (async)
         ↓
         → Returns: txHash, vcTransferJobId
```

### 4. VC Sync to Spring
```
API Gateway (after pet registration) → Spring POST /api/vc/sync
Request:
{
  "memberWallet": "0x...",
  "vcJwt": ["eyJhbG...", "eyJhbG..."]
}
         ↓
Spring decodes VCs → Creates/updates pet profiles
         ↓
Returns: PetVcDTO[] with DID references
```

---

## API Rate Limits & Best Practices

1. **Pagination:** Use default page size of 9, only increase if needed
2. **Caching:** Leverage `nextCursor` for efficient pagination
3. **Async Operations:** Check job status via jobId when needed
4. **File Uploads:** Respect 10MB limit for images
5. **Authentication:** Use refresh token to avoid re-login
6. **Biometric Proof:** Use within 10 minutes of generation
7. **Blockchain Fallback:** Indexer may fall back to direct blockchain queries

---

## Support & Documentation

- **Swagger UI:** Available at Spring backend URL + `/swagger-ui/index.html`
- **OpenAPI Spec:** Available at `/v3/api-docs`
- **API Gateway:** NestJS-based gateway with TypeScript
- **Blockchain:** Hyperledger Besu (private network)
- **Queue System:** BullMQ with Redis

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Generated by:** Claude Code Analysis
