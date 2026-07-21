import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { EuiLoadingService } from '@elemental-ui/core';

import { CheckMode, PortalCartitem } from '@imx-modules/imx-api-qer';
import { BaseCdr, ColumnDependentReference, SnackBarService, imx_SessionService } from 'qbm';
import { ShelfService } from '../../itshop/shelf.service';
import { ExtendedEntityWrapper } from '../../parameter-data/extended-entity-wrapper.interface';
import { QerApiService } from '../../qer-api-client.service';
import { ServiceItemsService } from '../../service-items/service-items.service';
import { CartItemsService } from '../../shopping-cart/cart-items.service';
import { UserModelService } from '../../user/user-model.service';

interface IdentityTypeOption {
  label: string;
  uidAccProduct: string;
}

const IDENTITY_TYPE_TABLE = 'CCCIdentityType';
const IDENTITY_TYPE_PRODUCT_COLUMN = 'CCC_UID_AccProduct';
const IDENTITY_TYPE_DISPLAY_COLUMN = 'CCC_Display';

@Component({
  selector: 'imx-create-identity',
  templateUrl: './create-identity.component.html',
  styleUrls: ['./create-identity.component.scss'],
})
export class CreateIdentityComponent implements OnInit, OnDestroy {
  public identityTypes: IdentityTypeOption[] = [];
  public selectedType: IdentityTypeOption | undefined;
  public cdrs: ColumnDependentReference[] = [];
  public formGroup = new UntypedFormGroup({});
  public busy = false;
  public formGroupIsPending = false;

  private cartItem: PortalCartitem | undefined;
  private extendedEntity: ExtendedEntityWrapper<PortalCartitem> | undefined;
  private submitted = false;

  constructor(
    private readonly serviceItemsService: ServiceItemsService,
    private readonly shelfService: ShelfService,
    private readonly cartItemsService: CartItemsService,
    private readonly userModelService: UserModelService,
    private readonly session: imx_SessionService,
    private readonly snackbar: SnackBarService,
    private readonly busyService: EuiLoadingService,
    private readonly qerApiService: QerApiService,
  ) {}

  public async ngOnInit(): Promise<void> {
    const overlayRef = this.busyService.show();
    try {
      const candidates = await this.qerApiService.client.portal_sqlwizard_candidates_get(IDENTITY_TYPE_TABLE);
      this.identityTypes = (candidates.Entities || [])
        .filter((entity) => !!entity.Columns?.[IDENTITY_TYPE_PRODUCT_COLUMN]?.Value)
        .map((entity) => ({
          label: entity.Columns?.[IDENTITY_TYPE_DISPLAY_COLUMN]?.Value ?? entity.Columns?.[IDENTITY_TYPE_PRODUCT_COLUMN]?.Value,
          uidAccProduct: entity.Columns?.[IDENTITY_TYPE_PRODUCT_COLUMN]?.Value,
        }));
    } catch {
      this.snackbar.open({ key: '#LDS#The identity types could not be loaded.' }, '#LDS#Close');
    } finally {
      this.busyService.hide(overlayRef);
    }
  }

  public async ngOnDestroy(): Promise<void> {
    await this.discardPendingItem();
  }

  public async onTypeChange(type: IdentityTypeOption): Promise<void> {
    await this.discardPendingItem();
    this.selectedType = type;

    this.busy = true;
    const overlayRef = this.busyService.show();
    try {
      const serviceItem = await this.serviceItemsService.getServiceItem(type.uidAccProduct, true);
      if (!serviceItem) {
        this.snackbar.open({ key: '#LDS#This product is currently not available for you.' }, '#LDS#Close');
        this.selectedType = undefined;
        return;
      }

      const sessionState = await this.session.getSessionState();
      const recipient = { DataValue: sessionState.UserUid ?? '', DisplayValue: sessionState.Username ?? '' };

      const [requestable] = this.serviceItemsService.getServiceItemsForPersons([serviceItem], [recipient]);

      const hasShop = await this.shelfService.setShops([requestable]);
      if (!hasShop || !requestable.UidITShopOrg) {
        this.selectedType = undefined;
        return;
      }

      const cartItemCollection = await this.cartItemsService.createAndPost(requestable, undefined);
      this.cartItem = cartItemCollection.Data[0];

      if (this.cartItem.UID_QERTermsOfUse?.value) {
        this.snackbar.open(
          { key: '#LDS#This product requires you to accept terms of use. Please complete this request from your shopping cart.' },
          '#LDS#Close',
        );
        this.selectedType = undefined;
        await this.discardPendingItem();
        return;
      }

      const key = this.cartItemsService.getKey(this.cartItem);
      this.extendedEntity = await this.cartItemsService.getInteractiveCartitem(key);
      this.cdrs = this.extendedEntity.parameterCategoryColumns.map((item) => new BaseCdr(item.column));
    } finally {
      this.busy = false;
      this.busyService.hide(overlayRef);
    }
  }

  public async onSubmit(): Promise<void> {
    if (!this.cartItem || !this.formGroup.valid) {
      return;
    }

    this.busy = true;
    const overlayRef = this.busyService.show();
    try {
      if (this.extendedEntity) {
        await this.cartItemsService.save(this.extendedEntity);
      }

      const uidCart = this.cartItem.UID_ShoppingCartOrder.value;
      const result = await this.cartItemsService.submit(uidCart, CheckMode.SubmitWithWarnings);

      if (result.HasErrors) {
        this.snackbar.open({ key: '#LDS#At least one request cannot be submitted.' }, '#LDS#Close');
        return;
      }

      this.submitted = true;
      this.snackbar.open({ key: '#LDS#Your shopping cart has been successfully submitted.' }, '#LDS#Close');
      await this.userModelService.reloadPendingItems();
      this.reset();
    } finally {
      this.busy = false;
      this.busyService.hide(overlayRef);
    }
  }

  private reset(): void {
    this.selectedType = undefined;
    this.cdrs = [];
    this.formGroup = new UntypedFormGroup({});
    this.cartItem = undefined;
    this.extendedEntity = undefined;
    this.submitted = false;
  }

  private async discardPendingItem(): Promise<void> {
    if (this.cartItem && !this.submitted) {
      await this.cartItemsService.removeItems([this.cartItem]);
    }
    this.cdrs = [];
    this.formGroup = new UntypedFormGroup({});
    this.cartItem = undefined;
    this.extendedEntity = undefined;
  }
}
