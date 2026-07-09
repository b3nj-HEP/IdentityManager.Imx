import { Component, OnDestroy } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { EuiLoadingService } from '@elemental-ui/core';

import { CheckMode, PortalCartitem } from '@imx-modules/imx-api-qer';
import { BaseCdr, ColumnDependentReference, SnackBarService, imx_SessionService } from 'qbm';
import { ShelfService } from '../../itshop/shelf.service';
import { ExtendedEntityWrapper } from '../../parameter-data/extended-entity-wrapper.interface';
import { ServiceItemsService } from '../../service-items/service-items.service';
import { CartItemsService } from '../../shopping-cart/cart-items.service';
import { UserModelService } from '../../user/user-model.service';

interface IdentityTypeOption {
  label: string;
  uidAccProduct: string;
}

const IDENTITY_TYPES: IdentityTypeOption[] = [
  { label: '#LDS#Entra ID Guest', uidAccProduct: '064b437c-edd5-463e-9679-c1b77096e490' },
  { label: '#LDS#Affiliate', uidAccProduct: 'a2eb6df0-9149-4c63-a43e-155e109683b6' },
];

@Component({
  selector: 'imx-create-identity',
  templateUrl: './create-identity.component.html',
  styleUrls: ['./create-identity.component.scss'],
})
export class CreateIdentityComponent implements OnDestroy {
  public readonly identityTypes = IDENTITY_TYPES;
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
  ) {}

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
