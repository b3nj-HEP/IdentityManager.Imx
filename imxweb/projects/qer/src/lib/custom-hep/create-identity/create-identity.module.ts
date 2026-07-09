import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CdrModule, RouteGuardService } from 'qbm';
import { RequestsFeatureGuardService } from '../../requests-feature-guard.service';
import { CreateIdentityComponent } from './create-identity.component';

export const CREATE_IDENTITY_ROUTE = 'createidentity';

const routes: Routes = [
  {
    path: CREATE_IDENTITY_ROUTE,
    component: CreateIdentityComponent,
    canActivate: [RequestsFeatureGuardService],
    resolve: [RouteGuardService],
  },
];

@NgModule({
  declarations: [CreateIdentityComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    RouterModule.forChild(routes),
    TranslateModule,
    CdrModule,
  ],
  exports: [CreateIdentityComponent],
})
export class CreateIdentityModule {}
