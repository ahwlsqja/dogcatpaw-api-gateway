import { Injectable } from '@nestjs/common';

@Injectable()
export class VcService {
  create() {
    return 'This action adds a new vc';
  }

  findAll() {
    return `This action returns all vc`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vc`;
  }



  remove(id: number) {
    return `This action removes a #${id} vc`;
  }
}
