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
    async saveNosePrintToPermanentStorage(fileName: string, petDID: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `nose-print-photo/${petDID}/${fileName}`,
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

    // 저장된 일상일지 사진을 일상일지 폴더로 이동시키는 함수
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

    // 저장된 입양 후기 일지 사진을 입양 후기 일지 폴더로 이동시키는 함수
    async saveReviewToPermanentStorage(fileName: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `review/${fileName}`,
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


    // 저장된 입양 공고 사진을 adoption 폴더로 이동시키는 함수
    async saveAdoptionToPermanentStorage(fileName: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `adoption/${fileName}`,
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

    // 저장된 후원 게시글 사진을 donation 폴더로 이동시키는 함수
    async saveDonationToPermanentStorage(fileName: string) {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            await this.s3.copyObject({
                Bucket: bucketName,
                CopySource: `${bucketName}/temp/${fileName}`,
                Key: `donation/${fileName}`,
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

    /**
     * Pet의 feature vector를 S3에 저장하는 함수
     * @param featureVector - ML 서버에서 추출한 feature vector
     * @param petDID - Pet의 고유 ID
     * @returns S3 URL 및 키 정보
     */
    async savePetFeatureVector(featureVector: number[], petDID: string): Promise<{ url: string; key: string }> {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            const key = `pet/petDID/${petDID}.json`;

            // Feature vector를 JSON 문자열로 변환
            const vectorData = JSON.stringify({
                petDID,
                featureVector,
                vectorSize: featureVector.length,
                createdAt: new Date().toISOString(),
                version: '1.0'
            });

            // S3에 업로드
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: vectorData,
                ContentType: 'application/json',
                ACL: ObjectCannedACL.public_read,
                Metadata: {
                    petDID: petDID,
                    vectorSize: featureVector.length.toString(),
                    uploadedAt: new Date().toISOString(),
                }
            });

            await this.s3.send(command);

            // Public URL 생성
            const endpoint = this.configService.get<string>(envVariableKeys.endpoint);
            const url = `${endpoint}/${bucketName}/${key}`;

            console.log(`Feature vector uploaded for pet ${petDID}: ${url}`);

            return {
                url,
                key
            };
        } catch (error) {
            console.error('Error uploading feature vector to S3:', error);
            throw new InternalServerErrorException('Feature vector 업로드 실패');
        }
    }

    /**
     * S3 temp 폴더에서 파일을 가져오는 함수
     * @param fileName - 파일 이름
     * @returns 파일 버퍼
     */
    async getFileFromTemp(fileName: string): Promise<Buffer> {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: `temp/${fileName}`
            });

            const result = await this.s3.send(command);
            const chunks: Uint8Array[] = [];

            for await (const chunk of result.Body as any) {
                chunks.push(chunk);
            }

            return Buffer.concat(chunks);
        } catch (error) {
            console.error('Error retrieving file from S3 temp:', error);
            throw new InternalServerErrorException(`S3 temp 폴더에서 파일을 가져오는데 실패했습니다: ${fileName}`);
        }
    }

    /**
     * S3에서 Pet의 feature vector를 가져오는 함수
     * @param petDID - Pet의 고유 ID
     * @returns Feature vector 데이터
     */
    async getPetFeatureVector(petDID: string): Promise<number[] | null> {
        try {
            const bucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
            const prefix = `pet/${petDID}/featureVector_`;

            // 해당 petDID의 가장 최근 feature vector 파일 찾기
            const listCommand = {
                Bucket: bucketName,
                Prefix: prefix,
                MaxKeys: 1000
            };

            const listResult = await this.s3.listObjectsV2(listCommand);

            if (!listResult.Contents || listResult.Contents.length === 0) {
                console.log(`No feature vector found for pet ${petDID}`);
                return null;
            }

            // 가장 최근 파일 선택 (LastModified 기준)
            const latestFile = listResult.Contents.reduce((latest, current) => {
                return current.LastModified > latest.LastModified ? current : latest;
            });

            // S3에서 파일 내용 가져오기
            const getCommand = new GetObjectCommand({
                Bucket: bucketName,
                Key: latestFile.Key
            });

            const result = await this.s3.send(getCommand);
            const bodyString = await result.Body.transformToString();
            const data = JSON.parse(bodyString);

            console.log(`✅ Feature vector retrieved for pet ${petDID}: ${data.vectorSize} dimensions`);
            return data.featureVector;

        } catch (error) {
            console.error('Error retrieving feature vector from S3:', error);
            return null;
        }
    }
};
