import { Injectable } from '@nestjs/common';
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
};
