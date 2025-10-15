// api-gateway/src/spring/spring.proxy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

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
    this.springBaseUrl = this.configService.get<string>('SPRING_SERVER_URL') || 'http://localhost:8080';
  }

  /**
   * Generic proxy method for Spring API calls
   */
  private async proxyToSpring(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: any,
    queryParams?: any,
    headers?: any
  ) {
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Gateway': 'dogcatpaw',
          ...headers,
        },
        params: queryParams
      };

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

      return response.data;
    } catch (error) {
      this.logger.error(`Spring API proxy error [${method.toUpperCase()} ${endpoint}]:`, error.message);
      throw error;
    }
  }

  // ==================== Pet API ====================
  async getMyPets(headers?: any) {
    return this.proxyToSpring('get', '/api/pet', undefined, undefined, headers);
  }

  // ==================== VC Sync API ====================
  async syncVc(data: any) {
    return this.proxyToSpring('post', '/api/vc/sync', data);
  }

  // ==================== Adoption API ====================
  async getAdoptions(queryParams: any) {
    return this.proxyToSpring('get', '/api/adoption/', undefined, queryParams);
  }

  async getAdoptionDetail(adoptId: number) {
    return this.proxyToSpring('get', '/api/adoption/detail', undefined, { adoptId });
  }

  async getAdoptionHome() {
    return this.proxyToSpring('get', '/api/adoption/home');
  }

  async createAdoptionPost(data: any, headers?: any) {
    return this.proxyToSpring('post', '/api/adoption/post', data, undefined, headers);
  }

  // ==================== Daily Story API ====================
  async createDailyStory(data: any, headers?: any) {
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
  async createReviewStory(data: any, headers?: any) {
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

  async writeComment(data: any, headers?: any) {
    return this.proxyToSpring('post', '/api/comment/', data, undefined, headers);
  }

  // ==================== Chat API ====================
  async createChatRoom(data: any, headers?: any) {
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
  async createDonationPost(data: any, headers?: any) {
    return this.proxyToSpring('post', '/api/donation/posts', data, undefined, headers);
  }

  async getDonationList(queryParams: any) {
    return this.proxyToSpring('get', '/api/donation/list', undefined, queryParams);
  }

  async getClosingSoonDonations() {
    return this.proxyToSpring('get', '/api/donation/closing');
  }

  async getDonation(queryParams: any) {
    return this.proxyToSpring('get', '/api/donation/', undefined, queryParams);
  }

  async makeDonation(data: any, headers?: any) {
    return this.proxyToSpring('post', '/api/donations', data, undefined, headers);
  }

  async getMyDonationHistory(queryParams: any, headers?: any) {
    return this.proxyToSpring('get', '/api/donations/mine', undefined, queryParams, headers);
  }

  async getMyBoneBalance(headers?: any) {
    return this.proxyToSpring('get', '/api/donations/bone', undefined, undefined, headers);
  }

  // ==================== Payment API ====================
  async preparePayment(data: any, headers?: any) {
    return this.proxyToSpring('post', '/api/payment/prepare', data, undefined, headers);
  }

  async approvePayment(data: any, headers?: any) {
    return this.proxyToSpring('post', '/api/payment/approve', data, undefined, headers);
  }
}
