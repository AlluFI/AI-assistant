import { Injectable } from '@nestjs/common';
import { ProfileService } from '../profile/profile.service';
import { RecipeFeedbackService } from '../recipe-feedback/recipe-feedback.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly profile: ProfileService,
    private readonly recipeFeedback: RecipeFeedbackService,
  ) {}

  status(email: string) {
    const isModerator = this.recipeFeedback.isModerator(email);
    const isPurgeAdmin = this.profile.isPurgeAdmin(email);
    return {
      isModerator,
      isPurgeAdmin,
      showAdminTab: isModerator || isPurgeAdmin,
    };
  }

  listDeletionQueue(email: string) {
    return this.profile.listPendingDeletions(email);
  }

  purgeDue(email: string) {
    return this.profile.purgeDueAsAdmin(email);
  }
}
