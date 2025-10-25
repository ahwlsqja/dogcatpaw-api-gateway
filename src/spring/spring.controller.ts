// api-gateway/src/spring/spring.controller.ts
import { Controller, Post, Get, Body, Param, UseGuards, Req, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { SpringService } from './spring.service';
import { SpringProxyService } from './spring.proxy.service';
import { VcProxyService } from '../vc/vc.proxy.service';
import { SpringAuthGuard } from '../auth/guard/spring-auth-guard';

// Import DTOs
import { CreateAdoptionPostDto } from './dto/adoption.dto';
import { CreateDailyStoryDto, CreateReviewStoryDto } from './dto/story.dto';
import { WriteCommentDto } from './dto/comment.dto';
import { CreateChatRoomDto } from './dto/chat.dto';
import { CreateDonationPostDto, MakeDonationDto, PreparePaymentDto, ApprovePaymentDto } from './dto/donation.dto';
import { WalletAddress } from 'src/auth/decorator/wallet-address.decorator';

@ApiTags('Spring Backend Proxy')
@Controller('api')
export class SpringController {
  constructor(
    private readonly springProxyService: SpringProxyService,
  ) {}

  // ==================== Spring API Proxy Endpoints ====================

  // ========== Pet Profile API ==========

  @Get('pet')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get My Pet List',
    description: `
**Retrieve all pets owned by the authenticated guardian from Spring backend database**

This endpoint returns pet profile information stored in the Spring backend, which may differ from blockchain pet registry data.

**Data Source:**
- Spring backend database (NOT blockchain PetDIDRegistry)
- Pets are linked to guardians through Spring's member-pet relationship table
- Pet data includes Spring-specific fields like adoption status, story count, etc.

**Returned Pet Information:**
- Pet ID (Spring database ID, different from blockchain petId)
- Pet name, species, breed, age, gender
- Profile images and descriptions
- Adoption status (if pet is available for adoption)
- Relationship to guardian (owner, foster, shelter)
- Daily story and review counts
- Registration date in Spring backend

**Use Cases:**
- Display user's pet list in profile page
- Select pet for creating adoption posts
- Select pet for writing daily stories or reviews
- Show pet dashboard with stats

**Integration with Other Endpoints:**
- Use returned petId for POST /api/adoption/post
- Use returned petId for POST /api/story/daily or POST /api/story/review
- Use returned petId for POST /api/donation/posts

**Blockchain vs Spring Backend:**
\`\`\`
Blockchain PetDIDRegistry:
- Pet DID (did:ethr:besu:0x...)
- Biometric hash (nose print)
- Owner (guardian wallet address)
- On-chain ownership history

Spring Backend (this endpoint):
- Pet ID (numeric database ID)
- Extended pet profile (photos, description, personality)
- Adoption posts, stories, donations
- Social features (likes, comments)
\`\`\`

**Authentication:**
- Requires valid JWT access token
- Returns only pets owned by the authenticated user

**Example Response:**
\`\`\`json
{
  "result": [
    {
      "petId": 12345,
      "name": "바둑이",
      "species": "DOG",
      "breed": "Golden Retriever",
      "age": 3,
      "gender": "M",
      "profileImage": "https://kr.object.ncloudstorage.com/.../profile.jpg",
      "adoptionStatus": "NOT_FOR_ADOPTION",
      "storyCount": 25,
      "reviewCount": 1,
      "registeredAt": "2024-01-15T10:30:00Z"
    }
  ]
}
\`\`\`
    `,
  })
  @ApiResponse({ status: 200, description: 'Pet list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  async getMyPets(@WalletAddress() walletAddress: string) {
    return this.springProxyService.getMyPets(walletAddress);
  }

  // ========== Adoption Post API ==========

  @Get('adoption')
  @ApiOperation({
    summary: 'Get Adoption Posts (Cursor-based Pagination)',
    description: `
**Retrieve adoption posts with filtering and cursor-based pagination**

This endpoint returns a list of adoption posts from the Spring backend. Posts can be filtered by status, breed, and location.

**Pagination:**
- Uses cursor-based pagination for efficient scrolling
- \`cursor\`: The ID of the last item from the previous page (for next page)
- \`size\`: Number of items per page (default: 10, max: 100)
- Returns \`nextCursor\` in response for fetching the next page

**Filtering Options:**
- \`status\`: "OPEN" (accepting applications), "PENDING" (under review), "CLOSED" (completed/cancelled)
- \`breed\`: Pet breed (e.g., "Golden Retriever", "시바견", "페르시안")
- \`region\`: Province/Region (e.g., "서울", "경기", "부산")
- \`district\`: City/District (e.g., "강남구", "수원시")

**Complete Flow:**
\`\`\`javascript
// 1. Initial load - get first page
const response1 = await fetch('/api/adoption?size=10');
// { posts: [...10 posts...], nextCursor: 45678 }

// 2. Load next page using cursor
const response2 = await fetch('/api/adoption?cursor=45678&size=10');
// { posts: [...10 more posts...], nextCursor: 45668 }

// 3. With filters
const filtered = await fetch('/api/adoption?status=OPEN&breed=Golden Retriever&region=서울&size=20');
\`\`\`

**Use Cases:**
- Display adoption post feed on home screen
- Browse available pets for adoption
- Filter posts by location and pet characteristics
- Infinite scroll implementation

**Example Response:**
\`\`\`json
{
  "result": {
    "posts": [
      {
        "adoptId": 123,
        "petId": 12345,
        "petName": "바둑이",
        "title": "사랑스러운 골든 리트리버 입양하세요!",
        "breed": "Golden Retriever",
        "age": 3,
        "region": "서울",
        "district": "강남구",
        "status": "OPEN",
        "images": ["pet-photo-1.jpg", "pet-photo-2.jpg"],
        "createdAt": "2025-10-20T10:00:00Z"
      }
    ],
    "nextCursor": 122,
    "hasMore": true
  }
}
\`\`\`

**No Authentication Required:**
- Public endpoint - anyone can browse adoption posts
- Authentication only required for creating posts or chatting
    `,
  })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: 'Cursor for pagination (ID of last item from previous page)' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Number of items per page (default: 10, max: 100)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by adoption status: OPEN, PENDING, CLOSED', enum: ['OPEN', 'PENDING', 'CLOSED'] })
  @ApiQuery({ name: 'breed', required: false, type: String, description: 'Filter by pet breed (e.g., "Golden Retriever", "시바견")' })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region/province (e.g., "서울", "경기")' })
  @ApiQuery({ name: 'district', required: false, type: String, description: 'Filter by district/city (e.g., "강남구", "수원시")' })
  @ApiResponse({ status: 200, description: 'Adoption posts retrieved successfully' })
  async getAdoptions(
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
    @Query('status') status?: string,
    @Query('breed') breed?: string,
    @Query('region') region?: string,
    @Query('district') district?: string,
  ) {
    return this.springProxyService.getAdoptions({ cursor, size, status, breed, region, district });
  }

  @Get('adoption/detail/:adoptId')
  @ApiOperation({
    summary: 'Get Adoption Post Detail',
    description: `
**Retrieve detailed information about a specific adoption post**

This endpoint returns complete adoption post details including pet information, guardian contact, and post content.

**Returned Information:**
- Complete adoption post data (title, content, images, deadline)
- Pet information (name, breed, age, gender, health status)
- Guardian information (name, wallet address, contact)
- Location details (region, district)
- Shelter information (if applicable)
- Post status and creation date
- View count and interaction statistics

**Use Cases:**
- Display adoption post detail page
- Show complete pet information to potential adopters
- Provide contact information for adoption inquiries
- Get adoption post data before creating chat room

**Flow to Adoption:**
\`\`\`
1. User browses adoption list (GET /api/adoption)
2. User clicks on post → GET /api/adoption/detail/:adoptId
3. User decides to inquire → POST /api/chat/room/create
4. Communication via WebSocket chat
5. If adoption succeeds → POST /api/adoption/:adoptionId/complete
6. Ownership transfer on blockchain → POST /pet/accept-transfer/:petDID
\`\`\`

**Example Response:**
\`\`\`json
{
  "result": {
    "adoptId": 123,
    "petId": 12345,
    "petName": "바둑이",
    "species": "DOG",
    "breed": "Golden Retriever",
    "age": 3,
    "gender": "M",
    "title": "사랑스러운 골든 리트리버 입양하세요!",
    "content": "건강하고 활발한 골든 리트리버입니다...",
    "images": ["photo1.jpg", "photo2.jpg"],
    "region": "서울",
    "district": "강남구",
    "shelterName": "서울 유기견 보호소",
    "contact": "010-1234-5678",
    "deadline": "2025-12-31",
    "status": "OPEN",
    "guardianAddress": "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
    "guardianName": "홍길동",
    "viewCount": 150,
    "createdAt": "2025-10-20T10:00:00Z"
  }
}
\`\`\`

**No Authentication Required:**
- Public endpoint - anyone can view adoption post details
    `,
  })
  @ApiParam({ name: 'adoptId', required: true, type: Number, description: 'Adoption post ID to retrieve details for' })
  @ApiResponse({ status: 200, description: 'Adoption post details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Not Found - Adoption post does not exist' })
  async getAdoptionDetail(@Param('adoptId', ParseIntPipe) adoptId: number) {
    return this.springProxyService.getAdoptionDetail(adoptId);
  }

  @Get('adoption/home')
  @ApiOperation({
    summary: 'Get Home Screen Data',
    description: `
**Retrieve curated content for the application home screen**

This endpoint returns a collection of featured content including recent adoption posts, popular stories, and trending donations.

**Returned Content Sections:**
- Featured adoption posts (最新 입양 공고)
- Recent daily stories (最신 일상 스토리)
- Latest adoption reviews (最신 입양 후기)
- Active donation campaigns (진행 중인 후원)
- Recommended pets for adoption
- Popular posts by interaction count

**Use Cases:**
- Display home screen feed
- Show curated content to new users
- Provide overview of platform activity
- Highlight urgent adoption cases

**Content Curation:**
- Posts are sorted by recency, popularity, or urgency
- May include algorithm-based recommendations
- Featured content is updated regularly
- Mix of different content types for engagement

**Example Response:**
\`\`\`json
{
  "result": {
    "featuredAdoptions": [
      { "adoptId": 123, "petName": "바둑이", "title": "...", "images": [...] }
    ],
    "recentStories": [
      { "storyId": 456, "title": "오늘의 산책", "author": "...", "likes": 45 }
    ],
    "reviewStories": [
      { "reviewId": 789, "title": "행복한 입양 후기", "petName": "..." }
    ],
    "activeDonations": [
      { "donationId": 321, "title": "긴급 수술비 후원", "progress": 65 }
    ]
  }
}
\`\`\`

**No Authentication Required:**
- Public endpoint - anyone can access home screen data
    `,
  })
  @ApiResponse({ status: 200, description: 'Home screen data retrieved successfully' })
  async getAdoptionHome() {
    return this.springProxyService.getAdoptionHome();
  }

  @Post('adoption/post')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create Adoption Post',
    description: `
**Create a new adoption post for a pet you own**

This endpoint allows guardians to create adoption posts to find new homes for their pets.

**Prerequisites:**
1. Guardian must be registered (POST /api/guardian/register)
2. Pet must be registered in Spring backend (GET /api/pet to see your pets)
3. Pet must be owned by the authenticated guardian
4. Images must be uploaded to S3 first (POST /common)

**Complete Adoption Post Creation Flow:**
\`\`\`javascript
// 1. Upload pet images to S3
const imageResponse1 = await fetch('/common', { method: 'POST' });
const { url: uploadUrl1, filename: filename1 } = await imageResponse1.json();
await fetch(uploadUrl1, { method: 'PUT', body: imageFile1 });

// 2. Repeat for more images
// ...

// 3. Create adoption post
const adoptionResponse = await fetch('/api/adoption/post', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    petId: 12345,  // From GET /api/pet
    title: '사랑스러운 골든 리트리버 입양하세요!',
    images: 'filename1.jpg,filename2.jpg,filename3.jpg',
    content: '건강하고 활발한 골든 리트리버입니다...',
    region: '서울',
    district: '강남구',
    shelterName: '서울 유기견 보호소',  // Required for ADMIN role
    contact: '010-1234-5678',
    deadline: '2025-12-31',
    status: 'OPEN'
  })
});
\`\`\`

**Field Requirements:**
- \`petId\`: Required, must be your pet from GET /api/pet
- \`title\`: Required, 5-100 characters
- \`images\`: Required, comma-separated S3 filenames
- \`content\`: Required, detailed description
- \`region\`, \`district\`: Optional but recommended for local adoption
- \`shelterName\`: Required for ADMIN role guardians
- \`contact\`: Optional contact information
- \`deadline\`: Optional adoption deadline
- \`status\`: Optional, defaults to "OPEN"

**Role-based Differences:**
- **USER role**: Individual pet owners, shelterName optional
- **ADMIN role**: Shelters/organizations, shelterName required

**After Creating Post:**
- Post appears in GET /api/adoption listing
- Potential adopters can contact you via POST /api/chat/room/create
- When adoption succeeds, call POST /api/adoption/:adoptionId/complete

**Authentication:**
- Requires valid JWT access token
- User must own the pet specified in petId
    `,
  })
  @ApiResponse({ status: 201, description: 'Adoption post created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid pet ID, missing required fields, or pet not owned by user' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  async createAdoptionPost(@Body() dto: CreateAdoptionPostDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.createAdoptionPost(dto, walletAddress);
  }

  @Post('adoption/:adoptionId/complete')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Complete Adoption Process',
    description: `
**Finalize the adoption and mark the adoption post as completed**

This endpoint is called by the ORIGINAL GUARDIAN after the adoption has been successfully completed on-chain and off-chain.

**When to Call This Endpoint:**
- After successful ownership transfer on blockchain (POST /pet/accept-transfer/:petDID)
- After both parties have agreed on the adoption
- After all paperwork and formalities are complete
- After pet has been physically transferred to new guardian

**Complete Adoption Flow:**
\`\`\`
Step 1: Original guardian creates adoption post
  → POST /api/adoption/post

Step 2: New guardian inquires via chat
  → POST /api/chat/room/create
  → WebSocket communication

Step 3: Original guardian initiates transfer
  → POST /pet/prepare-transfer/:petDID (guardian prepares VC)

Step 4: New guardian verifies biometric
  → POST /pet/verify-transfer/:petDID (nose print verification)

Step 5: New guardian accepts transfer (blockchain)
  → POST /pet/accept-transfer/:petDID/:adoptionId
  → On-chain ownership changes
  → Pet controller updated

Step 6: Original guardian completes adoption (Spring backend)
  → POST /api/adoption/:adoptionId/complete ← YOU ARE HERE
  → Adoption post marked as CLOSED
  → Statistics updated
\`\`\`

**What This Endpoint Does:**
1. Marks adoption post status as "CLOSED"
2. Records adoption completion in Spring database
3. Updates adoption statistics
4. Prevents further inquiries on this post
5. May trigger notifications to participants

**Authorization:**
- Only the original guardian (post creator) can complete the adoption
- Requires valid JWT access token
- Returns 403 if called by non-owner

**Example Request:**
\`\`\`javascript
await fetch('/api/adoption/123/complete', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});
\`\`\`

**Example Response:**
\`\`\`json
{
  "result": {
    "adoptionId": 123,
    "status": "CLOSED",
    "completedAt": "2025-10-26T14:30:00Z",
    "message": "입양이 성공적으로 완료되었습니다!"
  }
}
\`\`\`

**Important Notes:**
- This endpoint only updates Spring backend, NOT blockchain
- Blockchain ownership transfer must be done separately via /pet/accept-transfer
- Once completed, the adoption post cannot be reopened
- The adoption record is permanent for transparency and statistics
    `,
  })
  @ApiParam({ name: 'adoptionId', type: Number, description: 'Adoption post ID to mark as complete' })
  @ApiResponse({ status: 200, description: 'Adoption completed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the adoption post creator can complete the adoption' })
  @ApiResponse({ status: 404, description: 'Not Found - Adoption post does not exist' })
  async finalizeAdoption(@Param('adoptionId', ParseIntPipe) adoptionId: number, @WalletAddress() walletAddress: string) {
    return this.springProxyService.finalizeAdoption(adoptionId, walletAddress);
  }

  // ========== Daily Story API ==========

  @Post('story/daily')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create Daily Story',
    description: `
**Share your pet's daily activities and moments with the community**

This endpoint allows guardians to post daily stories about their pets' activities, behaviors, and special moments.

**Prerequisites:**
1. Guardian must be registered and authenticated
2. Pet must be registered in Spring backend (GET /api/pet)
3. Images must be uploaded to S3 first (POST /common) if including photos

**Complete Daily Story Creation Flow:**
\`\`\`javascript
// 1. (Optional) Upload images to S3
const imageResponse = await fetch('/common', { method: 'POST' });
const { url: uploadUrl, filename } = await imageResponse.json();
await fetch(uploadUrl, { method: 'PUT', body: imageFile });

// 2. Create daily story
const storyResponse = await fetch('/api/story/daily', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    petId: 12345,  // From GET /api/pet
    title: '오늘 첫 산책 다녀왔어요!',
    content: '오늘 처음으로 공원에서 산책을 했습니다...',
    images: 'daily-walk-1.jpg,daily-walk-2.jpg'  // Optional
  })
});
\`\`\`

**Use Cases:**
- Share daily pet activities and moments
- Document pet's growth and development
- Build community engagement
- Create memories and timeline of pet's life
- Share tips and experiences with other guardians

**After Creating Story:**
- Story appears in GET /api/story/daily/stories feed
- Other users can like (POST /api/like?storyId=X)
- Other users can comment (POST /api/comment)
- Story contributes to your pet's story count

**Community Features:**
- Stories are visible to all users
- Can receive likes and comments
- Helps build community of pet lovers
- Shares experiences and advice
    `,
  })
  @ApiResponse({ status: 201, description: 'Daily story created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid pet ID or missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  async createDailyStory(@Body() dto: CreateDailyStoryDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.createDailyStory(dto, walletAddress);
  }

  @Get('story/daily/stories')
  @ApiOperation({
    summary: 'Get All Daily Stories (Feed)',
    description: `
**Retrieve daily stories feed with cursor-based pagination**

Browse all daily stories shared by the pet guardian community, sorted by recency.

**Pagination:**
- Uses cursor-based pagination for infinite scroll
- \`cursorId\`: The ID of the last story from previous page
- \`size\`: Number of stories per page (default: 10, max: 50)

**Example Usage:**
\`\`\`javascript
// Initial load
const page1 = await fetch('/api/story/daily/stories?size=10');
// { stories: [...], nextCursor: 456 }

// Load next page
const page2 = await fetch('/api/story/daily/stories?cursorId=456&size=10');
\`\`\`

**Returned Story Information:**
- Story ID, title, content preview
- Pet information (name, image)
- Guardian information (nickname, profile)
- Images attached to story
- Like count and comment count
- Creation timestamp
- Read more link

**No Authentication Required:**
- Public endpoint - browse community stories
    `,
  })
  @ApiQuery({ name: 'cursorId', required: false, type: Number, description: 'Cursor for pagination (last story ID from previous page)' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Number of stories per page (default: 10, max: 50)' })
  @ApiResponse({ status: 200, description: 'Daily stories retrieved successfully' })
  async getDailyStories(
    @Query('cursorId') cursorId?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getDailyStories({ cursorId, size });
  }


  @Get('story/daily/:stories')
  @ApiOperation({
    summary: 'Get Single Daily Story Detail',
    description: `
**Retrieve complete details of a specific daily story**

View full story content, all images, and associated comments/likes.

**Returned Information:**
- Complete story content (not truncated)
- All attached images (full size URLs)
- Pet details (name, breed, age, photo)
- Guardian information (nickname, profile)
- Like count and list of users who liked
- Comment count and preview of recent comments
- Creation and last updated timestamps

**Use Cases:**
- Display full story detail page
- Show all images in gallery
- View and write comments
- Like/unlike the story

**Integration:**
- After viewing, users can like: POST /api/like?storyId=X
- After viewing, users can comment: POST /api/comment

**No Authentication Required:**
- Public endpoint - anyone can view story details
    `,
  })
  @ApiParam({ name: 'stories', type: Number, description: 'Daily story ID to retrieve' })
  @ApiResponse({ status: 200, description: 'Daily story retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Not Found - Story does not exist' })
  async getDailyStory(@Param('stories', ParseIntPipe) storyId: number) {
    return this.springProxyService.getDailyStory(storyId);
  }

  // ========== Adoption Review Story API ==========

  @Post('story/review')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create Adoption Review Story',
    description: `
**Share your adoption experience and help promote pet adoption**

This endpoint allows guardians to post adoption review stories, sharing their experiences with adopting a pet and encouraging others to adopt.

**Prerequisites:**
1. Guardian must be registered and authenticated
2. Pet must be registered and owned by the guardian
3. Pet should have been adopted (not originally owned)
4. Images must be uploaded to S3 first (POST /common)

**Complete Adoption Review Creation Flow:**
\`\`\`javascript
// 1. Upload images to S3
const imageResponse = await fetch('/common', { method: 'POST' });
const { url: uploadUrl, filename } = await imageResponse.json();
await fetch(uploadUrl, { method: 'PUT', body: imageFile });

// 2. Create review story
const reviewResponse = await fetch('/api/story/review', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    petId: 12345,
    title: '최고의 선택이었어요! 행복한 입양 후기',
    content: '3개월 전 보호소에서 입양했습니다...',
    adoptionAgency: '서울 유기견 보호소',
    adoptionDate: '2024-07-15',
    images: 'adoption-day.jpg,first-week.jpg'
  })
});
\`\`\`

**Purpose of Adoption Reviews:**
- Share positive adoption experiences
- Encourage others to adopt instead of buying
- Promote good shelters and rescue organizations
- Build trust in the adoption process
- Document the adoption journey
- Help potential adopters make informed decisions

**Use Cases:**
- Post after successful adoption
- Share adaptation process and tips
- Thank the adoption agency publicly
- Inspire others to adopt

**After Creating Review:**
- Review appears in GET /api/story/review/reviews feed
- Helps promote the adoption agency listed
- Can receive community support through likes/comments
- Contributes to adoption statistics
    `,
  })
  @ApiResponse({ status: 201, description: 'Adoption review created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid pet ID or missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  async createReviewStory(@Body() dto: CreateReviewStoryDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.createReviewStory(dto, walletAddress);
  }

  @Get('story/review/reviews')
  @ApiOperation({
    summary: 'Get All Adoption Review Stories',
    description: `
**Retrieve adoption review stories with cursor-based pagination**

Browse all adoption review stories shared by guardians who have adopted pets, sorted by recency.

**Pagination:**
- Uses cursor-based pagination
- \`cursorId\`: The ID of the last review from previous page
- \`size\`: Number of reviews per page (default: 10, max: 50)

**Returned Review Information:**
- Review ID, title, content preview
- Pet information (name, breed, before/after photos)
- Guardian information (nickname, profile)
- Adoption agency name
- Adoption date (how long they've been together)
- Images showing the adoption journey
- Like count and comment count
- Creation timestamp

**Use Cases:**
- Browse adoption success stories
- Get inspired to adopt
- Find recommended adoption agencies
- Read experiences from other adopters
- Assess compatibility before adopting

**Community Impact:**
- Promotes adoption culture
- Builds trust in rescue organizations
- Shares realistic expectations
- Encourages responsible pet ownership

**No Authentication Required:**
- Public endpoint - inspire potential adopters
    `,
  })
  @ApiQuery({ name: 'cursorId', required: false, type: Number, description: 'Cursor for pagination (last review ID)' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Number of reviews per page (default: 10, max: 50)' })
  @ApiResponse({ status: 200, description: 'Adoption reviews retrieved successfully' })
  async getReviewStories(
    @Query('cursorId') cursorId?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getReviewStories({ cursorId, size });
  }

  @Get('story/review/:reviews')
  @ApiOperation({
    summary: 'Get Single Adoption Review Detail',
    description: `
**Retrieve complete details of a specific adoption review**

View full adoption story, all photos, and journey details.

**Returned Information:**
- Complete review content (full story)
- All adoption journey images
- Pet details (name, breed, age at adoption, current age)
- Guardian information
- Adoption agency details and contact
- Adoption date and timeline
- Before/after comparisons (if available)
- Community engagement (likes, comments)

**Use Cases:**
- Read complete adoption success story
- View adoption journey photos
- Get detailed information about adoption agency
- Learn about specific pet breed experiences
- Assess time needed for pet adaptation

**No Authentication Required:**
- Public endpoint - anyone can read reviews
    `,
  })
  @ApiParam({ name: 'reviews', type: Number, description: 'Adoption review ID to retrieve' })
  @ApiResponse({ status: 200, description: 'Adoption review retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Not Found - Review does not exist' })
  async getReviewStory(@Param('reviews', ParseIntPipe) reviewId: number) {
    return this.springProxyService.getReviewStory(reviewId);
  }

  // ========== Like and Comment API ==========

  @Post('like')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Toggle Like on Story',
    description: `
**Like or unlike a daily story or adoption review**

This endpoint allows users to show appreciation for stories by toggling their like status.

**How It Works:**
- If user hasn't liked the story → adds like
- If user already liked the story → removes like
- One user can only like a story once
- Like count is automatically updated

**Use Cases:**
- Show appreciation for a story
- Support community members
- Bookmark favorite stories
- Increase engagement

**Example Usage:**
\`\`\`javascript
// Toggle like
const response = await fetch('/api/like?storyId=456', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});

// Response
{
  "result": {
    "storyId": 456,
    "liked": true,  // or false if unliked
    "totalLikes": 23
  }
}
\`\`\`

**Integration:**
- Call after viewing story detail page
- Update UI immediately for instant feedback
- Show heart icon as filled/unfilled based on liked status

**Authentication Required:**
- Must be logged in to like stories
    `,
  })
  @ApiQuery({ name: 'storyId', required: true, type: Number, description: 'Story ID to like/unlike (daily story or review story)' })
  @ApiResponse({ status: 200, description: 'Like toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  @ApiResponse({ status: 404, description: 'Not Found - Story does not exist' })
  async toggleLike(
    @Query('storyId', ParseIntPipe) storyId: number,
    @WalletAddress() walletAddress: string
  ) {
    return this.springProxyService.toggleLike(storyId, walletAddress);
  }

  @Get('comment')
  @ApiOperation({
    summary: 'Get Comments for Story',
    description: `
**Retrieve comments for a specific story with cursor-based pagination**

View all comments posted on a daily story or adoption review.

**Pagination:**
- Uses cursor-based pagination for efficient loading
- \`cursor\`: The ID of the last comment from previous page
- \`size\`: Number of comments per page (default: 20, max: 100)

**Returned Comment Information:**
- Comment ID, text content
- Commenter information (nickname, profile image, wallet address)
- Timestamp (created/updated)
- Nested replies (if supported)
- Like count on comment (if supported)

**Example Usage:**
\`\`\`javascript
// Get first page of comments
const page1 = await fetch('/api/comment?storyId=456&size=20');

// Load more comments
const page2 = await fetch('/api/comment?storyId=456&cursor=123&size=20');
\`\`\`

**Use Cases:**
- Display comment section on story detail page
- Load more comments on scroll
- Show community discussion
- Monitor feedback and questions

**Sorting:**
- Comments sorted by creation time (newest or oldest first)
- May include pinned comments at top

**No Authentication Required:**
- Public endpoint - anyone can view comments
    `,
  })
  @ApiQuery({ name: 'storyId', required: true, type: Number, description: 'Story ID to get comments for' })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: 'Cursor for pagination (last comment ID)' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Number of comments per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Not Found - Story does not exist' })
  async getComments(
    @Query('storyId', ParseIntPipe) storyId: number,
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getComments({ storyId, cursor, size });
  }

  @Post('comment')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Write Comment on Story',
    description: `
**Post a comment on a daily story or adoption review**

Share your thoughts, ask questions, or provide support through comments.

**Complete Comment Flow:**
\`\`\`javascript
// Post a comment
const response = await fetch('/api/comment', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    storyId: 456,
    comment: '정말 귀여운 강아지네요! 행복한 모습이 보기 좋습니다 :)'
  })
});

// Response
{
  "result": {
    "commentId": 789,
    "storyId": 456,
    "comment": "정말 귀여운 강아지네요!...",
    "author": {
      "walletAddress": "0x...",
      "nickname": "펫러버",
      "profileImage": "..."
    },
    "createdAt": "2025-10-26T15:00:00Z"
  }
}
\`\`\`

**Comment Guidelines:**
- Be respectful and supportive
- Provide constructive feedback
- Ask relevant questions
- Share similar experiences
- Avoid spam or offensive content
- Maximum 500 characters

**Use Cases:**
- Express appreciation
- Ask about pet care tips
- Share similar experiences
- Provide encouragement for adopters
- Request more information

**After Posting:**
- Comment appears immediately in GET /api/comment
- Story author may receive notification
- Comment count on story is incremented
- Community can view and respond

**Moderation:**
- Comments may be subject to community guidelines
- Report feature may be available
- Inappropriate comments may be removed

**Authentication Required:**
- Must be logged in to post comments
    `,
  })
  @ApiResponse({ status: 201, description: 'Comment posted successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid story ID or empty comment' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  @ApiResponse({ status: 404, description: 'Not Found - Story does not exist' })
  async writeComment(@Body() dto: WriteCommentDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.writeComment(dto, walletAddress);
  }

  // ========== Chat Room API ==========

  @Post('chat/room/create')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create Chat Room for Adoption',
    description: `
**Create a new chat room for adoption communication**

This endpoint creates a chat room between the adoption post writer (guardian) and an interested adopter.

**Complete Adoption Chat Flow:**
\`\`\`
Step 1: User A creates adoption post → GET adoption post details
Step 2: User B (current user) calls this endpoint to create chat room
Step 3: User B connects to WebSocket and joins room
Step 4: Both users communicate via WebSocket
\`\`\`

**Request Body:**
- \`adoptWriterId\`: **Wallet address** of the guardian who created the adoption post (lowercase)
- \`adoptId\`: The adoption post ID
- \`roomName\`: Optional custom name (defaults to adoption post title)

**Participants:**
- **Guardian (adoptWriterId)**: The user who created the adoption post
- **Adopter (Current User)**: The authenticated user creating the chat room

**Room Creation Logic:**
- Room is created only once per \`adoptId + adopter\` combination
- If room already exists between these users for this adoption, returns existing room
- Both participants are automatically added to \`chat_participant\` table
- Room is linked to the adoption post

**After Creation - WebSocket Integration:**

1. **Connect to WebSocket:**
\`\`\`javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  auth: { token: accessToken },  // JWT token from login
  transports: ['websocket'],
  reconnection: false
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
\`\`\`

2. **Join Room and Get Message History:**
\`\`\`javascript
socket.emit('joinRoom', { roomId: 123 }, (response) => {
  console.log('Joined:', response.success);
  console.log('Message history:', response.messages);
  // messages array contains all previous messages with:
  // - messageId, senderId, message, isRead, createdAt
});
\`\`\`

3. **Send Messages:**
\`\`\`javascript
socket.emit('sendMessage', {
  roomId: 123,
  message: '안녕하세요! 입양 문의드립니다.'
}, (response) => {
  console.log('Message sent:', response.success);
});
\`\`\`

4. **Receive Real-time Messages:**
\`\`\`javascript
socket.on('message', (data) => {
  console.log('New message from:', data.senderId);
  console.log('Message:', data.message);
  console.log('Created at:', data.createdAt);
});
\`\`\`

5. **Leave Room:**
\`\`\`javascript
socket.emit('leaveRoom', { roomId: 123 }, (response) => {
  console.log('Left room:', response.success);
});
\`\`\`

**Message Flow (NestJS ↔ Spring ↔ Redis):**
\`\`\`
User sends message via WebSocket
  ↓
NestJS ChatGateway receives message
  ↓
Publishes to Redis channel: "chat"
  ↓
Spring ChatMessageListener receives message
  ↓
Spring saves to database (chat_message table)
  ↓
Spring publishes to Redis: "nestjs:broadcast:{roomId}"
  ↓
NestJS receives broadcast and emits to all connected clients in room
  ↓
All users in room receive message via 'message' event
\`\`\`

**Database Tables Created:**
- \`chat_room\`: Room info, adoption_id, created_at
- \`chat_participant\`: wallet_address, room_id, joined_at
- \`chat_message\`: message content, sender_id, room_id, is_read, created_at

**Read Status:**
- Messages are marked as read when user calls \`POST /api/chat/:roomId/enter\`
- OR when user emits \`joinRoom\` WebSocket event
- \`isRead\` field indicates if message has been read by recipient

**Error Cases:**
- Adoption post not found → 404
- Invalid wallet address format → 400
- User not authenticated → 401
- Room creation fails → 500

**Example Complete Flow:**
\`\`\`javascript
// 1. Create room (REST API)
const createRoomResponse = await fetch('/api/chat/room/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    adoptWriterId: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
    adoptId: 456,
    roomName: '골든 리트리버 입양 문의'
  })
});
const { roomId } = await createRoomResponse.json();

// 2. Connect WebSocket
const socket = io('http://localhost:3000/chat', {
  auth: { token: accessToken }
});

// 3. Join room and get history
socket.emit('joinRoom', { roomId }, (response) => {
  console.log('Messages:', response.messages);
});

// 4. Listen for messages
socket.on('message', (msg) => {
  console.log('Received:', msg.message);
});

// 5. Send message
socket.emit('sendMessage', { roomId, message: 'Hello!' });
\`\`\`
    `,
  })
  @ApiResponse({ status: 201, description: 'Chat room created successfully', type: 'ChatRoomResponseDto' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid adoption post, wallet address format, or missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'Not Found - Adoption post does not exist' })
  async createChatRoom(@Body() dto: CreateChatRoomDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.createChatRoom(dto, walletAddress);
  }

  @Get('chat/room/list')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get All Chat Rooms',
    description: `
**Retrieve list of all available chat rooms**

This endpoint returns all chat rooms in the system.

**Use Cases:**
- Admin dashboard to view all conversations
- System monitoring and moderation
- Analytics on adoption communication patterns

**Note:**
- This endpoint may return ALL rooms in the system
- For user-specific rooms, consider filtering on the frontend
- Consider pagination for large datasets

**Response Includes:**
- Room ID
- Room name
- Participants
- Adoption post information
- Last message timestamp
- Unread message count (if applicable)
    `,
  })
  @ApiResponse({ status: 200, description: 'Chat room list retrieved successfully' })
  async getChatRoomList() {
    return this.springProxyService.getChatRoomList();
  }

  @Get('chat/room/card')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get Chat Room Card Information',
    description: `
**Get summary card information for a specific chat room**

This endpoint retrieves condensed information about a chat room, suitable for displaying in a chat list or room selector.

**Card Information Includes:**
- Room basic info (ID, name, created date)
- Participant details
- Associated adoption post details
- Last message preview
- Unread message count for the current user
- Room status and permissions

**Use Cases:**
- Display room preview in chat list
- Show room summary before entering
- Update room card in real-time when new messages arrive

**Permissions:**
- User must be a participant in the room to view the card
- Returns 403 if user is not authorized to view this room
    `,
  })
  @ApiQuery({
    name: 'roomId',
    required: true,
    type: Number,
    description: 'Chat room ID to get card information for',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'Chat room card retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not a participant in this room' })
  @ApiResponse({ status: 404, description: 'Not Found - Chat room does not exist' })
  async getChatRoomCard(
    @Query('roomId', ParseIntPipe) roomId: number,
    @Req() req: Request
  ) {
    const walletAddress = req.user?.address;
    return this.springProxyService.getChatRoomCard(roomId, walletAddress);
  }

  @Post('chat/:roomId/enter')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Enter Chat Room and Get Message History (REST API)',
    description: `
**Enter a chat room and retrieve complete message history**

This is an alternative REST API endpoint for entering a room. Most clients should use the WebSocket \`joinRoom\` event instead, as it provides the same functionality with real-time connection.

**What This Endpoint Does:**
1. Verifies user is a participant in the room (checks \`chat_participant\` table)
2. Marks all messages in the room as read for the current user (\`is_read = true\`)
3. Returns complete message history from room creation to now
4. Does NOT establish WebSocket connection (use WebSocket for real-time)

**Message History Format:**
\`\`\`javascript
{
  "result": {
    "roomId": 123,
    "messages": [
      {
        "messageId": 1,
        "senderId": "0x9c34c486ae5fc0def0ec9cd138ddc55e96f0d5e0",
        "senderName": "User B",
        "message": "안녕하세요! 입양 문의드립니다.",
        "isRead": true,  // marked as read
        "createdAt": "2025-10-25T12:30:00.000Z"
      },
      {
        "messageId": 2,
        "senderId": "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
        "senderName": "User A",
        "message": "네! 주말에 방문 가능하세요?",
        "isRead": true,
        "createdAt": "2025-10-25T12:31:00.000Z"
      }
    ]
  }
}
\`\`\`

**When to Use This vs WebSocket joinRoom:**

**Use REST API (this endpoint) when:**
- You want to fetch message history without establishing WebSocket connection
- Building a message preview or history viewer
- Pre-loading messages before connecting to WebSocket
- Implementing "mark as read" functionality

**Use WebSocket \`joinRoom\` event when:**
- Entering a room for real-time chat (recommended)
- You need both message history AND real-time updates
- Building interactive chat interface

**Recommended Flow (WebSocket Only):**
\`\`\`javascript
// Most apps should use WebSocket joinRoom directly:
const socket = io('http://localhost:3000/chat', {
  auth: { token: accessToken }
});

socket.on('connect', () => {
  // Join room - this automatically:
  // 1. Fetches message history
  // 2. Marks messages as read
  // 3. Subscribes to real-time updates
  socket.emit('joinRoom', { roomId: 123 }, (response) => {
    console.log('Message history:', response.messages);
    console.log('Total messages:', response.messages.length);
  });
});

// Listen for new messages
socket.on('message', (newMessage) => {
  console.log('New message:', newMessage);
});
\`\`\`

**Alternative Flow (REST + WebSocket):**
\`\`\`javascript
// 1. REST API: Get history and mark as read
const historyResponse = await fetch('/api/chat/123/enter', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + accessToken }
});
const { messages } = await historyResponse.json();
console.log('History loaded:', messages.length, 'messages');

// 2. WebSocket: Connect for real-time updates
const socket = io('http://localhost:3000/chat', {
  auth: { token: accessToken }
});

socket.on('connect', () => {
  // Still need to join room for real-time updates
  socket.emit('joinRoom', { roomId: 123 });
});

socket.on('message', (msg) => {
  console.log('Real-time message:', msg);
});
\`\`\`

**Read Status Behavior:**
- All messages in the room are marked as \`isRead = true\` for the current user
- Only affects the current user's read status (other participants unaffected)
- Read status is permanent (survives reconnection)
- Useful for "unread message count" badge

**Permissions:**
- User must be in \`chat_participant\` table for this room
- Returns 403 if user is not a participant
- Room creator and adopter are automatically added as participants

**Database Operations:**
\`\`\`sql
-- 1. Verify participation
SELECT * FROM chat_participant
WHERE room_id = ? AND wallet_address = ?

-- 2. Mark messages as read
UPDATE chat_message
SET is_read = true
WHERE room_id = ?
  AND sender_id != ?  -- don't mark own messages

-- 3. Fetch message history
SELECT * FROM chat_message
WHERE room_id = ?
ORDER BY created_at ASC
\`\`\`

**Error Cases:**
- User not a participant → 403 Forbidden
- Room does not exist → 404 Not Found
- Invalid roomId → 400 Bad Request
    `,
  })
  @ApiParam({
    name: 'roomId',
    type: Number,
    description: 'Chat room ID to enter',
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Entered room successfully, message history returned with all messages marked as read',
    schema: {
      example: {
        result: {
          roomId: 123,
          messages: [
            {
              messageId: 1,
              senderId: "0x9c34c486ae5fc0def0ec9cd138ddc55e96f0d5e0",
              senderName: "User B",
              message: "안녕하세요! 입양 문의드립니다.",
              isRead: true,
              createdAt: "2025-10-25T12:30:00.000Z"
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not a participant in this room' })
  @ApiResponse({ status: 404, description: 'Not Found - Chat room does not exist' })
  async enterChatRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @WalletAddress() walletAddress: string
  ) {
    return this.springProxyService.enterChatRoom(roomId, walletAddress);
  }

  @Get('chat/room/:roomId/adoption')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get Adoption Post Info for Chat Room',
    description: `
**Retrieve adoption post information associated with a chat room**

Every chat room is linked to a specific adoption post. This endpoint retrieves the adoption post details to display context within the chat interface.

**Returned Information:**
- Adoption post ID
- Pet information (name, species, age, photo)
- Guardian information (name, wallet address)
- Post content and description
- Adoption status
- Post creation date

**Use Cases:**
- Display adoption post summary in chat header
- Show pet details while chatting
- Verify adoption post status before proceeding with adoption
- Provide context for the conversation

**Integration with Chat:**
- Call this when user opens a chat room
- Display adoption info in chat header or sidebar
- Update UI if adoption status changes (e.g., adopted by someone else)

**Permissions:**
- User must be a participant in the chat room
- Returns 403 if user is not authorized to view this room
    `,
  })
  @ApiParam({
    name: 'roomId',
    type: Number,
    description: 'Chat room ID to get adoption info for',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'Adoption info retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not a participant in this room' })
  @ApiResponse({ status: 404, description: 'Not Found - Chat room or adoption post does not exist' })
  async getChatAdoptionInfo(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Req() req: Request
  ) {
    const walletAddress = req.user?.address;
    return this.springProxyService.getChatAdoptionInfo(roomId, walletAddress);
  }

  // ========== Donation Management API ==========

  @Post('donation/posts')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create Donation Post',
    description: `
**Create a fundraising campaign for your pet's medical or care expenses**

This endpoint allows guardians to create donation posts to raise funds ("bones") for their pets' needs.

**Complete Donation Post Creation Flow:**
\`\`\`javascript
// 1. Upload supporting images (medical records, vet receipts, etc.)
const imageResponse = await fetch('/common', { method: 'POST' });
const { url, filename } = await imageResponse.json();
await fetch(url, { method: 'PUT', body: imageFile });

// 2. Create donation post
const donationResponse = await fetch('/api/donation/posts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    memberId: 123,  // Usually auto-filled from JWT
    petId: 12345,
    title: '긴급 수술비 후원 요청 - 다리 골절 치료',
    targetAmount: 3000000,  // In KRW
    deadline: '2025-11-30',
    category: 'MEDICAL',
    content: '교통사고로 인해 뒷다리가 골절되었습니다...',
    images: 'xray.jpg,vet-diagnosis.jpg',
    bankName: '국민은행',
    accountNumber: '123-456-789012',
    accountHolder: '홍길동'
  })
});
\`\`\`

**Donation Categories:**
- \`MEDICAL\`: Surgery, treatment, medication
- \`FOOD\`: Food supplies and nutrition
- \`SHELTER\`: Housing and facility costs
- \`OTHER\`: Other pet care needs

**Dual Currency System:**
1. **Bones** (platform currency):
   - Users donate using "bones" purchased via POST /api/payment/prepare
   - Instant transfer, tracked on platform
   - Used for platform engagement

2. **Fiat Currency** (bank transfer):
   - Direct bank transfers to provided account
   - For users who prefer traditional donations
   - Guardian provides bank details

**Transparency Requirements:**
- Include medical documentation/receipts
- Explain specific need and cost breakdown
- Update progress regularly
- Report final outcome

**After Creating Post:**
- Post appears in GET /api/donation/list
- Users can donate via POST /api/donations
- Track progress in GET /api/donation/:donationId
- Update status when goal reached

**Use Cases:**
- Emergency medical expenses
- Ongoing treatment costs
- Food and supplies for rescued pets
- Shelter operation costs
    `,
  })
  @ApiResponse({ status: 201, description: 'Donation post created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data or missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  async createDonationPost(@Body() dto: CreateDonationPostDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.createDonationPost(dto, walletAddress);
  }

  @Get('donation/list')
  @ApiOperation({
    summary: 'Get All Donation Posts',
    description: `
**Browse donation campaigns with filtering and cursor-based pagination**

View all active and completed donation campaigns to support pets in need.

**Pagination:**
- Cursor-based pagination
- \`cursor\`: ID of last donation from previous page
- \`size\`: Items per page (default: 10, max: 100)

**Filtering:**
- \`status\`:
  - \`ACTIVE\`: Currently fundraising, not yet reached goal
  - \`ACHIEVED\`: Goal reached, still open for donations
  - \`CLOSED\`: Campaign ended
- \`breed\`: Filter by pet breed

**Returned Information:**
- Donation post details (title, category, deadline)
- Pet information (name, breed, age, photo)
- Guardian information
- Funding progress (current amount / target amount)
- Status and urgency indicators
- Bank account details (for direct transfers)
- Number of donors

**Example Usage:**
\`\`\`javascript
// Get active medical donations
const activeMedical = await fetch(
  '/api/donation/list?status=ACTIVE&size=20'
);

// Get donations for specific breed
const goldenRetrieverDonations = await fetch(
  '/api/donation/list?breed=Golden Retriever'
);
\`\`\`

**Use Cases:**
- Browse urgent medical cases
- Find donation campaigns by breed preference
- View completed successful campaigns
- Discover pets that need help

**No Authentication Required:**
- Public endpoint - encourage community support
    `,
  })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: 'Cursor for pagination' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
  @ApiQuery({ name: 'breed', required: false, type: String, description: 'Filter by pet breed' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status', enum: ['ACTIVE', 'ACHIEVED', 'CLOSED'] })
  @ApiResponse({ status: 200, description: 'Donation list retrieved successfully' })
  async getDonationList(
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
    @Query('breed') breed?: string,
    @Query('status') status?: string,
  ) {
    return this.springProxyService.getDonationList({ cursor, size, breed, status });
  }


  @Get('donation/:donationId')
  @ApiOperation({
    summary: 'Get Donation Detail and History',
    description: `
**Retrieve complete donation campaign details and contribution history**

View full information about a specific donation campaign including all donations received.

**Returned Information:**
1. **Campaign Details:**
   - Title, category, content
   - Pet information (name, breed, photos)
   - Guardian information
   - Target amount and current progress
   - Deadline and status
   - Bank account details
   - Supporting images/documents

2. **Donation History** (paginated):
   - List of all donors (nickname, amount, date)
   - Recent contributions
   - Total donors count
   - Largest single donation
   - Progress timeline

**Pagination for Donation History:**
- \`cursor\`: Last donation ID from previous page
- \`size\`: Number of donation records per page

**Example Usage:**
\`\`\`javascript
const campaignDetails = await fetch('/api/donation/123?size=20');

// Response
{
  "result": {
    "donationPost": {
      "donationId": 123,
      "title": "긴급 수술비 후원 요청",
      "category": "MEDICAL",
      "targetAmount": 3000000,
      "currentAmount": 2100000,
      "progress": 70,  // percentage
      "status": "ACTIVE",
      "deadline": "2025-11-30",
      ...
    },
    "donationHistory": [
      {
        "donorNickname": "동물사랑",
        "amount": 50000,  // in bones or KRW
        "donatedAt": "2025-10-25T10:00:00Z"
      },
      ...
    ],
    "nextCursor": 456
  }
}
\`\`\`

**Use Cases:**
- View campaign before donating
- Check funding progress
- See community support level
- Verify transparency of campaign
- Review donor history

**No Authentication Required:**
- Public endpoint - transparency builds trust
    `,
  })
  @ApiParam({ name: 'donationId', required: true, type: Number, description: 'Donation campaign ID' })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: 'Cursor for donation history pagination' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Number of donation records per page' })
  @ApiResponse({ status: 200, description: 'Donation details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Not Found - Donation campaign does not exist' })
  async getDonation(
    @Param('donationId', ParseIntPipe) donationId: number,
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getDonation(donationId, { cursor, size });
  }

  @Post('donations')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Make Donation',
    description: `
**Donate "bones" to a fundraising campaign**

Support pets in need by donating your bones to their campaign.

**Prerequisites:**
1. Must have sufficient bones in your account (check with GET /api/donations/bone)
2. If insufficient bones, purchase more via:
   - POST /api/payment/prepare
   - POST /api/payment/approve

**Complete Donation Flow:**
\`\`\`javascript
// 1. Check bone balance
const balanceResponse = await fetch('/api/donations/bone', {
  headers: { 'Authorization': 'Bearer ' + accessToken }
});
const { bones } = await balanceResponse.json();

// 2. If insufficient, buy more bones
if (bones < requiredBones) {
  // a. Prepare payment
  const prepareResponse = await fetch('/api/payment/prepare', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ itemId: 2 })  // Bone package ID
  });
  const { orderId, amount } = await prepareResponse.json();

  // b. User completes payment via payment gateway (Toss, Iamport, etc.)

  // c. Approve payment
  await fetch('/api/payment/approve', {
    method: 'POST',
    body: JSON.stringify({ orderId, paymentKey, finalAmount: amount })
  });
}

// 3. Make donation
const donationResponse = await fetch('/api/donations', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    memberId: 456,  // Auto-filled from JWT
    itemId: 2,  // Bone package (10 bones, 50 bones, etc.)
    donationId: 123
  })
});

// Response
{
  "result": {
    "donationId": 123,
    "amount": 50,  // bones donated
    "remainingBones": 450,
    "totalDonated": 2150000,  // campaign total
    "message": "후원해 주셔서 감사합니다!"
  }
}
\`\`\`

**Bone Packages (itemId):**
- Check available packages in system
- Each itemId represents a specific number of bones
- Example: itemId 1 = 10 bones, itemId 2 = 50 bones, etc.

**After Donation:**
- Bones are deducted from your account
- Donation is recorded in campaign history
- Campaign progress is updated
- You can view your donations in GET /api/donations/mine

**Use Cases:**
- Support medical emergencies
- Help shelter operations
- Contribute to community causes
- Show compassion and solidarity
    `,
  })
  @ApiResponse({ status: 201, description: 'Donation made successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Insufficient bones or invalid donation ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  @ApiResponse({ status: 404, description: 'Not Found - Donation campaign does not exist' })
  async makeDonation(@Body() dto: MakeDonationDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.makeDonation(dto, walletAddress);
  }

  @Get('donations/mine')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get My Donation History',
    description: `
**Retrieve your personal donation history with pagination**

View all donations you have made to various campaigns.

**Pagination:**
- Cursor-based pagination
- \`cursor\`: Last donation ID from previous page
- \`size\`: Donations per page (default: 20, max: 100)

**Returned Information:**
- Donation ID and amount
- Campaign details (title, pet name, category)
- Donation date
- Campaign status (ongoing, achieved, closed)
- Your impact (percentage of campaign you funded)
- Total bones donated across all campaigns

**Example Response:**
\`\`\`json
{
  "result": {
    "donations": [
      {
        "donationId": 123,
        "campaignTitle": "긴급 수술비 후원 요청",
        "petName": "바둑이",
        "amount": 50,  // bones
        "donatedAt": "2025-10-25T10:00:00Z",
        "campaignStatus": "ACHIEVED"
      },
      ...
    ],
    "totalDonated": 500,  // total bones ever donated
    "campaignCount": 12,  // number of campaigns supported
    "nextCursor": 456
  }
}
\`\`\`

**Use Cases:**
- Track your contributions
- View impact on community
- Generate donation receipts
- Review supported campaigns
- Monitor campaign outcomes

**Authentication Required:**
- Returns only your personal donations
    `,
  })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: 'Cursor for pagination' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Donations per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Donation history retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  async getMyDonationHistory(
    @WalletAddress() walletAddress: string,
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getMyDonationHistory({ cursor, size }, walletAddress);
  }

  @Get('donations/bone/')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get My Bone Balance',
    description: `
**Check your current bone balance available for donations**

View how many bones you have available to donate to campaigns.

**What are Bones?**
- Platform virtual currency for donations
- Purchase via POST /api/payment/prepare and /api/payment/approve
- 1 bone ≈ equivalent value in KRW (check current exchange rate)
- Used exclusively for supporting donation campaigns
- Cannot be withdrawn, only donated

**Returned Information:**
- Current bone balance
- Total bones ever purchased
- Total bones ever donated
- Recent bone transactions (purchases/donations)
- Pending transactions (if any)

**Example Response:**
\`\`\`json
{
  "result": {
    "currentBalance": 450,
    "totalPurchased": 1000,
    "totalDonated": 550,
    "recentTransactions": [
      {
        "type": "PURCHASE",
        "amount": 500,
        "date": "2025-10-20T10:00:00Z"
      },
      {
        "type": "DONATION",
        "amount": -50,
        "campaignTitle": "긴급 수술비 후원",
        "date": "2025-10-25T10:00:00Z"
      }
    ]
  }
}
\`\`\`

**Use Cases:**
- Check balance before donating
- Decide if need to purchase more bones
- Track bone usage
- View transaction history

**How to Get More Bones:**
1. POST /api/payment/prepare - initiate purchase
2. Complete payment via payment gateway
3. POST /api/payment/approve - finalize transaction
4. Bones added to your account instantly

**Authentication Required:**
- Returns your personal bone balance
    `,
  })
  @ApiResponse({ status: 200, description: 'Bone balance retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  async getMyBoneBalance(@WalletAddress() walletAddress: string) {
    return this.springProxyService.getMyBoneBalance(walletAddress);
  }

  // ========== Payment API ==========

  @Post('payment/prepare')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Prepare Payment for Bone Purchase',
    description: `
**Initialize payment transaction to purchase bones**

This endpoint prepares a payment order for purchasing bone packages. After preparation, user completes payment via external gateway (Toss Payments, Iamport, etc.).

**Complete Payment Flow:**
\`\`\`javascript
// Step 1: Prepare payment
const prepareResponse = await fetch('/api/payment/prepare', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    itemId: 2  // Bone package ID (e.g., 50 bones for 5000 KRW)
  })
});

const { orderId, amount, itemName, customerEmail } = await prepareResponse.json();

// Step 2: User completes payment via payment gateway
// Example with Toss Payments
const paymentWidget = TossPayments(clientKey);
await paymentWidget.requestPayment({
  method: 'CARD',
  amount: amount,
  orderId: orderId,
  orderName: itemName,
  customerEmail: customerEmail,
  successUrl: 'https://yourapp.com/payment/success',
  failUrl: 'https://yourapp.com/payment/fail'
});

// Step 3: After payment gateway redirects to successUrl
// Extract paymentKey from URL params and approve payment
const urlParams = new URLSearchParams(window.location.search);
const paymentKey = urlParams.get('paymentKey');

// Step 4: Finalize payment
await fetch('/api/payment/approve', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderId: orderId,
    paymentKey: paymentKey,
    finalAmount: amount
  })
});

// Bones are now added to your account!
\`\`\`

**Bone Packages (itemId):**
- itemId 1: 10 bones for 1,000 KRW
- itemId 2: 50 bones for 5,000 KRW
- itemId 3: 100 bones for 10,000 KRW
- itemId 4: 500 bones for 50,000 KRW
(Check system for current packages and pricing)

**Returned Prepare Information:**
- \`orderId\`: Unique order identifier for this transaction
- \`amount\`: Payment amount in KRW
- \`itemName\`: Description of bone package
- \`customerEmail\`: User email for payment receipt
- \`expiresAt\`: Order expiration time (usually 30 minutes)

**Payment Gateway Integration:**
- Supports Toss Payments, Iamport, KG Inicis, etc.
- Choose payment method: credit card, bank transfer, mobile payment
- Secure PCI-compliant payment processing
- Automatic fraud detection

**Important Notes:**
- Order expires after 30 minutes (varies by gateway)
- Payment must be approved via POST /api/payment/approve
- Bones added only after successful approval
- Failed payments do not charge or add bones
- Refunds handled through payment gateway

**Use Cases:**
- Purchase bones before donating
- Buy bones in advance for future donations
- Support multiple campaigns
- Participate in platform economy
    `,
  })
  @ApiResponse({ status: 200, description: 'Payment preparation successful, order created' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid item ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  async preparePayment(@Body() dto: PreparePaymentDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.preparePayment(dto, walletAddress);
  }

  @Post('payment/approve')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Approve Payment and Add Bones',
    description: `
**Finalize payment and credit bones to user account**

This endpoint verifies the payment with the payment gateway and adds purchased bones to the user's account.

**When to Call:**
- After user completes payment via payment gateway
- Payment gateway redirects to your success URL
- Extract \`paymentKey\` and \`orderId\` from URL parameters
- Call this endpoint to finalize and verify payment

**Complete Approval Flow:**
\`\`\`javascript
// 1. Extract params from payment gateway redirect
const urlParams = new URLSearchParams(window.location.search);
const paymentKey = urlParams.get('paymentKey');
const orderId = urlParams.get('orderId');
const finalAmount = parseInt(urlParams.get('amount'));

// 2. Approve payment
const approveResponse = await fetch('/api/payment/approve', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderId: orderId,
    paymentKey: paymentKey,
    finalAmount: finalAmount
  })
});

const result = await approveResponse.json();
// {
//   "success": true,
//   "orderId": "ORDER-123",
//   "bones": 50,  // Bones added
//   "newBalance": 500,  // Total bone balance
//   "amount": 5000,  // KRW charged
//   "message": "결제가 완료되었습니다!"
// }

// 3. Redirect to success page or update UI
console.log(\`Successfully purchased \${result.bones} bones!\`);
console.log(\`New balance: \${result.newBalance} bones\`);
\`\`\`

**What This Endpoint Does:**
1. Verifies payment with payment gateway using paymentKey
2. Checks order exists and matches finalAmount
3. Confirms payment was actually processed and charged
4. Prevents duplicate payments (idempotent)
5. Adds bones to user account in database
6. Records transaction history
7. Returns confirmation with new balance

**Security Validations:**
- Payment key must be valid from gateway
- Order ID must match prepared order
- Final amount must match prepared amount (anti-fraud)
- User must be the order owner
- Payment must not have been previously approved
- Gateway confirms payment was successful

**Error Handling:**
- If payment verification fails → bones not added, order marked as failed
- If amount mismatch → transaction rejected, fraud alert
- If duplicate approval → returns original success, bones not added again
- If gateway returns failure → user shown error, no charge

**Example Response:**
\`\`\`json
{
  "result": {
    "success": true,
    "orderId": "ORDER-2025-10-26-ABC123",
    "bones": 50,
    "newBalance": 500,
    "amount": 5000,
    "paymentMethod": "CARD",
    "approvedAt": "2025-10-26T15:30:00Z",
    "message": "결제가 완료되었습니다! 50개의 뼈다귀가 충전되었습니다."
  }
}
\`\`\`

**After Approval:**
- Bones immediately available for donations
- Check balance: GET /api/donations/bone
- View transaction: GET /api/donations/mine
- Donate to campaigns: POST /api/donations

**Authentication Required:**
- User must own the order being approved
    `,
  })
  @ApiResponse({ status: 200, description: 'Payment approved successfully, bones added to account' })
  @ApiResponse({ status: 400, description: 'Bad Request - Payment verification failed, amount mismatch, or invalid payment key' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  @ApiResponse({ status: 404, description: 'Not Found - Order does not exist' })
  async approvePayment(@Body() dto: ApprovePaymentDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.approvePayment(dto, walletAddress);
  }

  // ========== Admin API ==========

  @Get('admin')
  @ApiBearerAuth('access-token')
  @UseGuards(SpringAuthGuard)
  @ApiOperation({
    summary: 'Get All Members and Pets (Admin Only)',
    description: `
**Retrieve complete list of all registered guardians and their pets**

This endpoint is restricted to ADMIN role users and provides comprehensive oversight of all platform members.

**Admin Access Only:**
- Requires ADMIN role in guardian registration
- Regular USER role will receive 403 Forbidden
- Used for platform administration and moderation

**Pagination:**
- Cursor-based pagination using ISO date-time
- \`cursor\`: ISO timestamp of last member from previous page (e.g., "2025-10-26T12:00:00Z")
- \`size\`: Members per page (default: 10, max: 100)

**Returned Information:**
1. **Member Details:**
   - Guardian wallet address
   - Email and phone (if available)
   - Name and nickname
   - Profile information
   - Role (USER or ADMIN)
   - Registration date
   - Last active date
   - Account status (active, suspended, etc.)

2. **Pet Information for Each Member:**
   - List of all pets owned by guardian
   - Pet names, species, breeds
   - Pet DIDs (if blockchain-registered)
   - Adoption status
   - Registration dates

3. **Activity Statistics:**
   - Number of adoption posts created
   - Number of daily stories posted
   - Number of review stories posted
   - Donation campaigns created
   - Total donations made/received
   - Community engagement metrics

**Example Usage:**
\`\`\`javascript
// Get first page
const page1 = await fetch('/api/admin?size=20', {
  headers: { 'Authorization': 'Bearer ' + adminAccessToken }
});

const { members, nextCursor } = await page1.json();

// Get next page
const page2 = await fetch(\`/api/admin?cursor=\${nextCursor}&size=20\`, {
  headers: { 'Authorization': 'Bearer ' + adminAccessToken }
});
\`\`\`

**Example Response:**
\`\`\`json
{
  "result": {
    "members": [
      {
        "walletAddress": "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
        "email": "user@example.com",
        "name": "홍길동",
        "nickname": "펫러버",
        "role": "USER",
        "registeredAt": "2025-01-15T10:00:00Z",
        "lastActive": "2025-10-26T14:00:00Z",
        "pets": [
          {
            "petId": 12345,
            "petDID": "did:ethr:besu:0xabc...",
            "name": "바둑이",
            "species": "DOG",
            "breed": "Golden Retriever"
          }
        ],
        "stats": {
          "adoptionPosts": 2,
          "dailyStories": 15,
          "reviewStories": 1,
          "donationCampaigns": 0,
          "totalDonationsMade": 500
        }
      }
    ],
    "nextCursor": "2025-01-14T10:00:00Z",
    "totalMembers": 1500,
    "hasMore": true
  }
}
\`\`\`

**Admin Use Cases:**
- Monitor platform growth and activity
- Identify suspicious accounts or spam
- Provide customer support
- Generate analytics and reports
- Moderate content and users
- Verify shelter/organization accounts (ADMIN role applications)
- Track adoption success rates
- Monitor donation campaigns for transparency

**Security:**
- Admin role verified via JWT token and guardian role in database
- Sensitive data (private keys, passwords) never exposed
- Audit logging for admin access
- Rate limiting to prevent abuse

**Authorization Check:**
\`\`\`
1. Extract wallet address from JWT token
2. Query guardian table for user role
3. If role !== 'ADMIN' → return 403 Forbidden
4. If role === 'ADMIN' → proceed with query
\`\`\`

**Performance:**
- Optimized queries with proper indexing
- Cursor-based pagination prevents offset issues
- Response caching for frequently accessed data
- Database read replicas for scalability
    `,
  })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Cursor for pagination (ISO date-time string of last member from previous page)' })
  @ApiQuery({ name: 'size', required: false, type: Number, description: 'Number of members per page (default: 10, max: 100)' })
  @ApiResponse({ status: 200, description: 'Member list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Login required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getAdminMembers(
    @WalletAddress() walletAddress: string,
    @Query('cursor') cursor?: string,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getAdminMembers(cursor, size, walletAddress);
  }
}
