// api-gateway/src/spring/spring.proxy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

// Import DTOs
import { VcSyncDto } from './dto/vc-sync.dto';
import { CreateAdoptionPostDto } from './dto/adoption.dto';
import { CreateDailyStoryDto, CreateReviewStoryDto } from './dto/story.dto';
import { WriteCommentDto } from './dto/comment.dto';
import { CreateChatRoomDto } from './dto/chat.dto';
import { CreateDonationPostDto, MakeDonationDto, PreparePaymentDto, ApprovePaymentDto } from './dto/donation.dto';

/**
 * Spring API Proxy Service
 * Handles all HTTP proxy calls to Spring backend
 */
@Injectable()
export class SpringProxyService {
  private readonly logger = new Logger(SpringProxyService.name);
  private springBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.springBaseUrl = this.configService.get<string>(envVariableKeys.springurl) || 'http://localhost:8080';
  }

  /**
   * 프록시 메서드
   * Public으로 변경하여 ChatService에서도 사용 가능
   */
  async proxyToSpring(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: any,
    queryParams?: any,
    headers?: any
  ) {
    console.log(headers)
    try {
      // headers가 문자열이면 그대로 사용, 객체면 authorization에서 지갑 주소 추출 시도
      let walletAddress = headers;
      if (typeof headers === 'object' && headers !== null) {
        // headers 객체에서 authorization 토큰을 통해 지갑 주소 추출 불가능
        // 이 경우 headers는 잘못 전달된 것이므로 undefined 처리
        walletAddress = undefined;
      }

      const config = {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Gateway': 'dogcatpaw',
          'X-Wallet-Address': walletAddress,
        },
        params: queryParams
      };

      console.log(config)
      

      let response;
      if (method === 'get' || method === 'delete') {
        response = await firstValueFrom(
          this.httpService[method](
            `${this.springBaseUrl}${endpoint}`,
            config
          )
        );
      } else {
        response = await firstValueFrom(
          this.httpService[method](
            `${this.springBaseUrl}${endpoint}`,
            data,
            config
          )
        );
      }
      console.log(response.data)

      return response.data;
    } catch (error) {
      this.logger.error(`Spring API proxy error [${method.toUpperCase()} ${endpoint}]:`, error.message);
      throw error;
    }
  }

  // ==================== Member API ====================
  /**
   * Get member role from Spring backend
   * @param walletAddress - Wallet address of the member
   * @returns Role information (ADMIN or USER)
   */
  async getMemberRole(walletAddress: string) {
    return this.proxyToSpring('get', '/api/member/role', undefined, undefined, walletAddress);
  }

  // ==================== Admin API ====================
  /**
   * Get all members with pagination (Admin only)
   * @param cursor - Cursor for pagination (ISO date-time string)
   * @param size - Number of items per page (default: 10)
   * @returns Paginated list of members with their pets
   */
  async getAdminMembers(cursor?: string, size?: number, headers?: any) {
    const queryParams: any = {};
    if (cursor) queryParams.cursor = cursor;
    if (size !== undefined) queryParams.size = size;

    return this.proxyToSpring('get', '/api/admin', undefined, queryParams, headers);
  }

  // ==================== Pet API ====================
  async getMyPets(headers?: any) {
    console.log(headers)
    return this.proxyToSpring('get', '/api/pet', undefined, undefined, headers);
  }

  // ==================== VC Sync API ====================
  async syncVc(data: VcSyncDto) {
    return this.proxyToSpring('post', '/api/vc/sync', data);
  }

  // ==================== Adoption API ====================
  async getAdoptions(queryParams: any) {
    return this.proxyToSpring('get', '/api/adoption/', undefined, queryParams);
  }

  async getAdoptionDetail(adoptId: number) {
    return this.proxyToSpring('get', `/api/adoption/detail/${adoptId}`);
  }

  /**
   * 
   * 
   */
  async getAdoptionHome() {
    return this.proxyToSpring('get', '/api/adoption/home');
  }

  // 연결 완료
  async createAdoptionPost(data: CreateAdoptionPostDto, headers?: any) {
    return this.proxyToSpring('post', '/api/adoption/post', data, undefined, headers);
  }

  // 펫 이전
  async finalizeAdoption(adoptionId: number, headers?: any) {
    return this.proxyToSpring('post', `/api/adoption/${adoptionId}/complete`, undefined, { adoptionId }, headers);
  }

  // ==================== Daily Story API ====================
  async createDailyStory(data: CreateDailyStoryDto, headers?: any) {
    return this.proxyToSpring('post', '/api/story/daily', data, undefined, headers);
  }

  async getDailyStories(queryParams: any) {
    return this.proxyToSpring('get', '/api/story/daily/stories', undefined, queryParams);
  }

  async getDailyStory(storyId: number) {
    return this.proxyToSpring('get', `/api/story/daily/${storyId}`);
  }

  async searchDailyStories(queryParams: any, headers?: any) {
    return this.proxyToSpring('get', '/api/story/daily/search', undefined, queryParams, headers);
  }

  // ==================== Review Story API ====================
  async createReviewStory(data: CreateReviewStoryDto, headers?: any) {
    return this.proxyToSpring('post', '/api/story/review', data, undefined, headers);
  }

  async getReviewStories(queryParams: any) {
    return this.proxyToSpring('get', '/api/story/review/reviews', undefined, queryParams);
  }

  async getReviewStory(reviewId: number) {
    return this.proxyToSpring('get', `/api/story/review/${reviewId}`);
  }

  async searchReviewStories(queryParams: any, headers?: any) {
    return this.proxyToSpring('get', '/api/story/review/search', undefined, queryParams, headers);
  }

  // ==================== Like API ====================
  async toggleLike(storyId: number, headers?: any) {
    return this.proxyToSpring('post', '/api/like/', undefined, { storyId }, headers);
  }

  // ==================== Comment API ====================
  async getComments(queryParams: any) {
    return this.proxyToSpring('get', '/api/comment/', undefined, queryParams);
  }

  async writeComment(data: WriteCommentDto, headers?: any) {
    return this.proxyToSpring('post', '/api/comment/', data, undefined, headers);
  }

  // ==================== Chat API ====================
  async createChatRoom(data: CreateChatRoomDto, headers?: any) {
    return this.proxyToSpring('post', '/api/chat/room/create', data, undefined, headers);
  }

  async getChatRoomList(headers?: any) {
    return this.proxyToSpring('get', '/api/chat/room/list', undefined, undefined, headers);
  }

  async getChatRoomCard(roomId: number, headers?: any) {
    return this.proxyToSpring('get', '/api/chat/room/card', undefined, { roomId }, headers);
  }

  async enterChatRoom(roomId: number, headers?: any) {
    return this.proxyToSpring('post', `/api/chat/${roomId}/enter`, undefined, undefined, headers);
  }

  async getChatAdoptionInfo(roomId: number, headers?: any) {
    return this.proxyToSpring('get', `/api/chat/room/${roomId}/adoption`, undefined, undefined, headers);
  }

  // ==================== Donation API ====================
  async createDonationPost(data: CreateDonationPostDto, headers?: any) {
    return this.proxyToSpring('post', '/api/donation/posts', data, undefined, headers);
  }

  async getDonationList(queryParams: any) {
    return this.proxyToSpring('get', '/api/donation/list', undefined, queryParams);
  }

  async getDonation(donationId: number, queryParams?: any) {
    return this.proxyToSpring('get', `/api/donation/${donationId}`, undefined, queryParams);
  }

  async makeDonation(data: MakeDonationDto, headers?: any) {
    return this.proxyToSpring('post', '/api/donations', data, undefined, headers);
  }

  async getMyDonationHistory(queryParams: any, headers?: any) {
    return this.proxyToSpring('get', '/api/donations/mine', undefined, queryParams, headers);
  }

  async getMyBoneBalance(headers?: any) {
    return this.proxyToSpring('get', '/api/donations/bone', undefined, undefined, headers);
  }

  // ==================== Payment API ====================
  async preparePayment(data: PreparePaymentDto, headers?: any) {
    return this.proxyToSpring('post', '/api/payment/prepare', data, undefined, headers);
  }

  async approvePayment(data: ApprovePaymentDto, headers?: any) {
    return this.proxyToSpring('post', '/api/payment/approve', data, undefined, headers);
  }
}
