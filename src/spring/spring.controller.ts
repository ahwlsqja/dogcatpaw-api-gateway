// api-gateway/src/spring/spring.controller.ts
import { Controller, Post, Get, Body, Param, UseGuards, Req, Query, Headers, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { SpringService } from './spring.service';
import { SpringProxyService } from './spring.proxy.service';
import { VcProxyService } from '../vc/vc.proxy.service';
import { SpringAuthGuard } from '../auth/guard/spring-auth-guard';
import { Public } from '../auth/decorator/public.decorator';

// Import DTOs
import { VcSyncDto } from './dto/vc-sync.dto';
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
    private readonly springService: SpringService,
    private readonly springProxyService: SpringProxyService,
    private readonly vcProxyService: VcProxyService,
  ) {}

  // ==================== Spring API Proxy Endpoints ====================

  // ========== Pet Profile API ==========

  // 내 반려동물 조회
  @Get('pet')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my pet list (내 반려동물 조회)' })
  async getMyPets(@WalletAddress() walletAddress: string) {
    return this.springProxyService.getMyPets(walletAddress);
  }

  // ========== Adoption Post API ==========

  // 입양 공고 조회
  @Get('adoption')
  @ApiOperation({ summary: 'Get adoption posts (cursor-based) (입양 공고 조회)' })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'breed', required: false, type: String })
  @ApiQuery({ name: 'region', required: false, type: String })
  @ApiQuery({ name: 'district', required: false, type: String })
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

  // 입양 공고 상세 페이지 조회
  @Get('adoption/detail')
  @ApiOperation({ summary: 'Get adoption post detail (입양 게시 글 상세보기 조회)' })
  @ApiQuery({ name: 'adoptId', required: true, type: Number })
  async getAdoptionDetail(@Query('adoptId', ParseIntPipe) adoptId: number) {
    return this.springProxyService.getAdoptionDetail(adoptId);
  }

  // 홈 화면 조회
  @Get('adoption/home')
  @ApiOperation({ summary: 'Get home screen (홈 화면 조회)' })
  async getAdoptionHome() {
    return this.springProxyService.getAdoptionHome();
  }

  // 입양 공고 작성
  @Post('adoption/post')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create adoption post (입양 게시 작성)' })
  async createAdoptionPost(@Body() dto: CreateAdoptionPostDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.createAdoptionPost(dto, walletAddress);
  }

  // ========== Daily Story API ==========
  // 일상 일지 작성
  @Post('story/daily')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create daily story (일상 글쓰기 작성)' })
  async createDailyStory(@Body() dto: CreateDailyStoryDto, @WalletAddress() walletAddress: string) {
    return this.springProxyService.createDailyStory(dto, walletAddress);
  }

  //
  @Get('story/daily/stories')
  @ApiOperation({ summary: 'Get all daily stories (최신 일상 글쓰기 전체 조회)' })
  @ApiQuery({ name: 'cursorId', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async getDailyStories(
    @Query('cursorId') cursorId?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getDailyStories({ cursorId, size });
  }

  @Public()
  @Get('story/daily/:stories')
  @ApiOperation({ summary: 'Get single daily story (일상 글쓰기 하나 조회)' })
  @ApiParam({ name: 'stories', type: Number })
  async getDailyStory(@Param('stories', ParseIntPipe) storyId: number) {
    return this.springProxyService.getDailyStory(storyId);
  }

  @Get('story/daily/search')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search daily stories (일상 글쓰기 검색하기)' })
  @ApiQuery({ name: 'keyword', required: true, type: String })
  @ApiQuery({ name: 'cursorId', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async searchDailyStories(
    @Query('keyword') keyword: string,
    @Query('cursorId') cursorId?: number,
    @Query('size') size?: number,
    @Headers() headers?: any,
  ) {
    return this.springProxyService.searchDailyStories({ keyword, cursorId, size }, headers);
  }

  // ========== Adoption Review Story API ==========

  @Post('story/review')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create adoption review (입양 후기 게시 작성)' })
  async createReviewStory(@Body() dto: CreateReviewStoryDto, @Headers() headers: any) {
    return this.springProxyService.createReviewStory(dto, headers);
  }

  @Public()
  @Get('story/review/reviews')
  @ApiOperation({ summary: 'Get all adoption reviews (최신 입양 후기 전체 조회)' })
  @ApiQuery({ name: 'cursorId', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async getReviewStories(
    @Query('cursorId') cursorId?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getReviewStories({ cursorId, size });
  }

  @Public()
  @Get('story/review/:reviews')
  @ApiOperation({ summary: 'Get single adoption review (입양 후기 글 조회)' })
  @ApiParam({ name: 'reviews', type: Number })
  async getReviewStory(@Param('reviews', ParseIntPipe) reviewId: number) {
    return this.springProxyService.getReviewStory(reviewId);
  }

  @Get('story/review/search')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search adoption reviews (입양 후기 검색하기)' })
  @ApiQuery({ name: 'keyword', required: true, type: String })
  @ApiQuery({ name: 'cursorId', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async searchReviewStories(
    @Query('keyword') keyword: string,
    @Query('cursorId') cursorId?: number,
    @Query('size') size?: number,
    @Headers() headers?: any,
  ) {
    return this.springProxyService.searchReviewStories({ keyword, cursorId, size }, headers);
  }

  // ========== Like and Comment API ==========

  @Post('like')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle like (좋아요 토글)' })
  @ApiQuery({ name: 'storyId', required: true, type: Number })
  async toggleLike(
    @Query('storyId', ParseIntPipe) storyId: number,
    @Headers() headers: any
  ) {
    return this.springProxyService.toggleLike(storyId, headers);
  }

  @Public()
  @Get('comment')
  @ApiOperation({ summary: 'Get comments (댓글 조회)' })
  @ApiQuery({ name: 'storyId', required: true, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async getComments(
    @Query('storyId', ParseIntPipe) storyId: number,
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getComments({ storyId, cursor, size });
  }

  @Post('comment')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Write comment (댓글 작성)' })
  async writeComment(@Body() dto: WriteCommentDto, @Headers() headers: any) {
    return this.springProxyService.writeComment(dto, headers);
  }

  // ========== Chat Room API ==========

  @Post('chat/room/create')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create chat room (채팅방 만들기)' })
  async createChatRoom(@Body() dto: CreateChatRoomDto, @Headers() headers: any) {
    return this.springProxyService.createChatRoom(dto, headers);
  }

  @Get('chat/room/list')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat room list (채팅방 전체 조회)' })
  async getChatRoomList(@Headers() headers: any) {
    return this.springProxyService.getChatRoomList(headers);
  }

  @Get('chat/room/card')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat room card info (채팅방 카드 정보 조회)' })
  @ApiQuery({ name: 'roomId', required: true, type: Number })
  async getChatRoomCard(
    @Query('roomId', ParseIntPipe) roomId: number,
    @Headers() headers: any
  ) {
    return this.springProxyService.getChatRoomCard(roomId, headers);
  }

  @Post('chat/:roomId/enter')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enter chat room and get messages (채팅방 입장 및 메시지 조회하기)' })
  @ApiParam({ name: 'roomId', type: Number })
  async enterChatRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Headers() headers: any
  ) {
    return this.springProxyService.enterChatRoom(roomId, headers);
  }

  @Get('chat/room/:roomId/adoption')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get adoption info for chat (채팅방 연결 입양 게시 조회)' })
  @ApiParam({ name: 'roomId', type: Number })
  async getChatAdoptionInfo(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Headers() headers: any
  ) {
    return this.springProxyService.getChatAdoptionInfo(roomId, headers);
  }

  // ========== Donation Management API ==========

  @Post('donation/posts')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create donation post (후원 게시 글 작성하기)' })
  async createDonationPost(@Body() dto: CreateDonationPostDto, @Headers() headers: any) {
    return this.springProxyService.createDonationPost(dto, headers);
  }

  @Public()
  @Get('donation/list')
  @ApiOperation({ summary: 'Get all donation list (cursor-based) (폴더 - 전체 후원 리스트)' })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'breed', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'ACTIVE, ACHIEVED, CLOSED' })
  async getDonationList(
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
    @Query('breed') breed?: string,
    @Query('status') status?: string,
  ) {
    return this.springProxyService.getDonationList({ cursor, size, breed, status });
  }

  @Public()
  @Get('donation/closing')
  @ApiOperation({ summary: 'Get closing soon donations (홈화면 - 마감 임박 후원 3개)' })
  async getClosingSoonDonations() {
    return this.springProxyService.getClosingSoonDonations();
  }

  @Public()
  @Get('donation')
  @ApiOperation({ summary: 'Get donation detail + donation history (후원 게시 글 및 정보 + 후원 내역 조회)' })
  @ApiQuery({ name: 'donationId', required: true, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async getDonation(
    @Query('donationId', ParseIntPipe) donationId: number,
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
  ) {
    return this.springProxyService.getDonation({ donationId, cursor, size });
  }

  @Post('donations')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Make donation (후원하기)' })
  async makeDonation(@Body() dto: MakeDonationDto, @Headers() headers: any) {
    return this.springProxyService.makeDonation(dto, headers);
  }

  @Get('donations/mine')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my donation history (paginated) (나의 후원내역 내역 조회하기)' })
  @ApiQuery({ name: 'cursor', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async getMyDonationHistory(
    @Query('cursor') cursor?: number,
    @Query('size') size?: number,
    @Headers() headers?: any,
  ) {
    return this.springProxyService.getMyDonationHistory({ cursor, size }, headers);
  }

  @Get('donations/bone')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my bone balance (나의 후원 가능한 뼈다귀 조회)' })
  async getMyBoneBalance(@Headers() headers: any) {
    return this.springProxyService.getMyBoneBalance(headers);
  }

  // ========== Payment API ==========

  @Post('payment/prepare')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Prepare payment (뼈다귀 충전 준비)' })
  async preparePayment(@Body() dto: PreparePaymentDto, @Headers() headers: any) {
    return this.springProxyService.preparePayment(dto, headers);
  }

  @Post('payment/approve')
  @UseGuards(SpringAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve payment (뼈다귀 서비스 승인)' })
  async approvePayment(@Body() dto: ApprovePaymentDto, @Headers() headers: any) {
    return this.springProxyService.approvePayment(dto, headers);
  }
}
