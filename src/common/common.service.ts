import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ObjectCannedACL, PutObjectCommand, S3, GetObjectCommand } from '@aws-sdk/client-s3'
import {v4 as Uuid} from 'uuid';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from './const/env.const';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class CommonService {
    private s3: S3

    constructor(
        private readonly configService: ConfigService,
    ) {
        this.s3 = new S3({
            endpoint: this.configService.get<string>(envVariableKeys.endpoint),
            credentials: {
                accessKeyId: this.configService.get<string>(envVariableKeys.awsaccesekey),
                secretAccessKey: this.configService.get<string>(envVariableKeys.awssecretaccesskey),
            },
            region: this.configService.get<string>(envVariableKeys.awsregion),
            forcePathStyle: true, // Required for S3-compatible services like NCP Object Storage
        });
    }

    async createPresignedUrl(expiresIn = 300){
        const params = {
            Bucket: this.configService.get<string>(envVariableKeys.awss3bucketname),
            Key: `temp/${Uuid()}.jpg`, // Unique file name,
            ACL: ObjectCannedACL.public_read,
        };

        try {
            const url = await getSignedUrl(this.s3, new PutObjectCommand(params), { expiresIn })
            console.log(url);
            return url;
        } catch (error) {
            console.error('Error creating presigned URL:', error);
            throw error;
        }
    }

    // 저장된 이미지를 nose-print-photo 폴더로 이동시키는 함수 
    async saveNosePrintToPermanentStorage(fileName: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `nose-print-photo/${fileName}`,
                ACL: 'public-read',
            });

            await this.s3
                .deleteObject({
                    Bucket: bucketName,
                    Key: `temp/${fileName}`,
                });
        } catch (e) {
            console.log(e);
            throw new InternalServerErrorException('S3 에러!');
        }
    }


    // 저장된 보호자 프로필 사진을 guardian 폴더로 이동시키는 함수 
    async saveGuardianToPermanentStorage(fileName: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `guardian/${fileName}`,
                ACL: 'public-read',
            });

            await this.s3
                .deleteObject({
                    Bucket: bucketName,
                    Key: `temp/${fileName}`,
                });
        } catch (e) {
            console.log(e);
            throw new InternalServerErrorException('S3 에러!');
        }
    }

    // 저장된 펫 프로필 사진을 pet 폴더로 이동시키는 함수 
    async savePetToPermanentStorage(fileName: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `pet/${fileName}`,
                ACL: 'public-read',
            });

            await this.s3
                .deleteObject({
                    Bucket: bucketName,
                    Key: `temp/${fileName}`,
                });
        } catch (e) {
            console.log(e);
            throw new InternalServerErrorException('S3 에러!');
        }
    }

    // 저장된 입양일지 사진을 pet 폴더로 이동시키는 함수 
    async saveDiaryToPermanentStorage(fileName: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `diary/${fileName}`,
                ACL: 'public-read',
            });

            await this.s3
                .deleteObject({
                    Bucket: bucketName,
                    Key: `temp/${fileName}`,
                });
        } catch (e) {
            console.log(e);
            throw new InternalServerErrorException('S3 에러!');
        }
    }
};
