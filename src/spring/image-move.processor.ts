// api-gateway/src/spring/image-move.processor.ts
import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CommonService } from 'src/common/common.service';
import { SpringService } from './spring.service';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

export interface PetImageMoveJob {
    petDID: string;
    noseImageFileName: string;
    profileImageFileNames: string[];
    guardianAddress: string;
    petData: {
        petName?: string;
        breed?: string;
        old?: number;
        weight?: number;
        gender?: string;
        color?: string;
        feature?: string;
        neutral?: boolean;
        specifics: string;
        images: string;
    };
}

export interface GuardianImageMoveJob {
    guardianAddress: string;
    profileImageFileName: string;
    guardianData: {
        email?: string;
        phone?: string;
        name?: string;
        gender?: string;
        old?: number;
        address?: string;
        nickname?: string;
    };
    role: 'USER' | 'ADMIN';
}

@Processor('image-move')
@Injectable()
export class ImageMoveProcessor {
    private readonly logger = new Logger(ImageMoveProcessor.name);
    private s3Endpoint: string;
    private s3BucketName: string;

    constructor(
        private readonly commonService: CommonService,
        private readonly springService: SpringService,
        private readonly configService: ConfigService,
    ) {
        this.s3Endpoint = this.configService.get<string>(envVariableKeys.endpoint);
        this.s3BucketName = this.configService.get<string>(envVariableKeys.awss3bucketname);
        this.logger.log('Image Move Processor initialized');
    }

    /**
     * Generate full S3 public URL
     */
    private generateS3Url(key: string): string {
        return `${this.s3Endpoint}/${this.s3BucketName}/${key}`;
    }

    @OnQueueActive()
    onActive(job: Job) {
        if (job.name === 'move-pet-images') {
            const data = job.data as PetImageMoveJob;
            this.logger.log(`Processing job ${job.id} - Moving images for pet ${data.petDID}`);
        } else if (job.name === 'move-guardian-image') {
            const data = job.data as GuardianImageMoveJob;
            this.logger.log(`Processing job ${job.id} - Moving profile image for guardian ${data.guardianAddress}`);
        }
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: any) {
        this.logger.log(`Job ${job.id} completed - Type: ${job.name}`);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(
            `❌ Job ${job.id} failed - Type: ${job.name} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
            error.stack
        );
    }

    /**
     * Move pet images from temp to permanent storage
     * Then trigger Spring sync
     */
    @Process('move-pet-images')
    async handlePetImageMove(job: Job<PetImageMoveJob>) {
        const {
            petDID,
            noseImageFileName,
            profileImageFileNames,
            guardianAddress,
            petData
        } = job.data;

        try {
            const startTime = Date.now();

            // 1. Move nose print image to nose-print-photo folder
            await this.commonService.saveNosePrintToPermanentStorage(noseImageFileName, petDID);
            this.logger.log(`✅ Nose print image moved: nose-print-photo/${petDID}/${noseImageFileName}`);

            // 2. Move profile images to pet folder
            const movedProfileImageUrls: string[] = [];
            for (const imageFileName of profileImageFileNames) {
                await this.commonService.savePetToPermanentStorage(imageFileName);
                const imageUrl = this.generateS3Url(`pet/${imageFileName}`);
                movedProfileImageUrls.push(imageUrl);
                this.logger.log(`✅ Pet profile image moved: pet/${imageFileName} -> ${imageUrl}`);
            }

            const duration = Date.now() - startTime;
            this.logger.log(`✅ All images moved in ${duration}ms for pet ${petDID}`);

            // 3. Update petData with full S3 URLs
            const updatedPetData = {
                ...petData,
                images: movedProfileImageUrls.join(','), // Full URLs: "https://endpoint.com/bucket/pet/file1.jpg,..."
            };

            // 4. Trigger Spring sync after images are ready with updated paths
            const springJobId: string | number = await this.springService.queuePetRegistration(
                guardianAddress,
                petDID,
                updatedPetData
            );
            this.logger.log(`✅ Triggered Spring sync - Job ID: ${springJobId}`);

            return {
                success: true,
                petDID,
                noseImageMoved: true,
                profileImagesMoved: profileImageFileNames.length,
                springJobId,
                duration
            };
        } catch (error) {
            this.logger.error(`❌ Image move error for ${petDID}:`, error.message);
            throw error; // Bull will retry
        }
    }

    /**
     * Move guardian profile image from temp to permanent storage
     * Then trigger Spring sync
     */
    @Process('move-guardian-image')
    async handleGuardianImageMove(job: Job<GuardianImageMoveJob>) {
        const {
            guardianAddress,
            profileImageFileName,
            guardianData,
            role
        } = job.data;

        try {
            const startTime = Date.now();

            // 1. Move profile image to guardian folder
            await this.commonService.saveGuardianToPermanentStorage(profileImageFileName);
            const profileImageUrl = this.generateS3Url(`guardian/${profileImageFileName}`);
            this.logger.log(`✅ Guardian profile image moved: guardian/${profileImageFileName} -> ${profileImageUrl}`);

            const duration = Date.now() - startTime;
            this.logger.log(`✅ Guardian image moved in ${duration}ms for guardian ${guardianAddress}`);

            // 2. Update guardianData with full S3 URL
            const updatedGuardianData = {
                ...guardianData,
                profileUrl: profileImageUrl, // Full URL: "https://endpoint.com/bucket/guardian/file.jpg"
            };

            // 3. Trigger Spring sync after image is ready with updated path
            let springJobId: string | number;
            if (role === 'USER') {
                springJobId = await this.springService.queueUserRegister(
                    guardianAddress,
                    updatedGuardianData
                );
            } else {
                springJobId = await this.springService.queueAdminRegister(
                    guardianAddress,
                    updatedGuardianData
                );
            }
            this.logger.log(`✅ Triggered Spring sync - Job ID: ${springJobId}`);

            return {
                success: true,
                guardianAddress,
                profileImageMoved: true,
                springJobId,
                duration
            };
        } catch (error) {
            this.logger.error(`❌ Guardian image move error for ${guardianAddress}:`, error.message);
            throw error; // Bull will retry
        }
    }
}
