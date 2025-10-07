import { Injectable } from '@nestjs/common';
import { CreateVcDto } from './dto/create-vc.dto';
import { UpdateVcDto } from './dto/update-vc.dto';

@Injectable()
export class VcService {
  create(createVcDto: CreateVcDto) {
    return 'This action adds a new vc';
  }

  findAll() {
    return `This action returns all vc`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vc`;
  }

  update(id: number, updateVcDto: UpdateVcDto) {
    return `This action updates a #${id} vc`;
  }

  remove(id: number) {
    return `This action removes a #${id} vc`;
  }
}
