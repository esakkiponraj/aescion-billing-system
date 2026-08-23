import {
  BusinessType,
  BUSINESS_TYPE_CAPABILITIES,
  getBusinessTypeCapability,
} from '@aescion/types';

describe('AESCION Business-Type Capability Architecture', () => {
  describe('Capability Registry Profiles', () => {
    it('should provide complete capabilities for SUPERMARKET', () => {
      const cap = getBusinessTypeCapability(BusinessType.SUPERMARKET);
      expect(cap.businessType).toBe(BusinessType.SUPERMARKET);
      expect(cap.posMode).toBe('FAST_BILLING');
      expect(cap.inventoryMode).toBe('BARCODE_RETAIL');
      expect(cap.enabledModules.pos).toBe(true);
      expect(cap.enabledModules.inventory).toBe(true);
      expect(cap.enabledModules.services).toBe(false);
      expect(cap.enabledModules.tablesAndOrders).toBe(false);
      expect(cap.terminology.itemLabel).toBe('Product');
      expect(cap.terminology.posAction).toBe('Fast Billing (POS)');
      expect(cap.dashboardCapabilities.showFastBillingAction).toBe(true);
      expect(cap.dashboardCapabilities.showLowStockWidget).toBe(true);
    });

    it('should provide complete capabilities for RETAIL', () => {
      const cap = getBusinessTypeCapability(BusinessType.RETAIL);
      expect(cap.businessType).toBe(BusinessType.RETAIL);
      expect(cap.posMode).toBe('FAST_BILLING');
      expect(cap.inventoryMode).toBe('BARCODE_RETAIL');
      expect(cap.enabledModules.pos).toBe(true);
      expect(cap.enabledModules.inventory).toBe(true);
      expect(cap.terminology.itemLabel).toBe('Product');
      expect(cap.terminology.posAction).toBe('Retail POS');
    });

    it('should provide complete capabilities for WHOLESALE', () => {
      const cap = getBusinessTypeCapability(BusinessType.WHOLESALE);
      expect(cap.businessType).toBe(BusinessType.WHOLESALE);
      expect(cap.posMode).toBe('WHOLESALE_ORDER');
      expect(cap.inventoryMode).toBe('BULK_WHOLESALE');
      expect(cap.enabledModules.pos).toBe(false);
      expect(cap.enabledModules.inventory).toBe(true);
      expect(cap.enabledModules.quotations).toBe(true);
      expect(cap.terminology.posAction).toBe('Bulk Billing');
      expect(cap.terminology.customerLabel).toBe('Wholesale Account');
      expect(cap.dashboardCapabilities.showBulkOrdersWidget).toBe(true);
    });

    it('should provide complete capabilities for RESTAURANT', () => {
      const cap = getBusinessTypeCapability(BusinessType.RESTAURANT);
      expect(cap.businessType).toBe(BusinessType.RESTAURANT);
      expect(cap.category).toBe('HOSPITALITY');
      expect(cap.posMode).toBe('TABLE_SERVICE');
      expect(cap.inventoryMode).toBe('INGREDIENTS');
      expect(cap.enabledModules.pos).toBe(true);
      expect(cap.enabledModules.tablesAndOrders).toBe(true);
      expect(cap.enabledModules.kitchenKOT).toBe(true);
      expect(cap.terminology.itemLabel).toBe('Menu Item');
      expect(cap.terminology.orderLabel).toBe('Food Order / KOT');
      expect(cap.dashboardCapabilities.showTableStatusWidget).toBe(true);
    });

    it('should provide complete capabilities for SERVICE (non-POS, job/work order driven)', () => {
      const cap = getBusinessTypeCapability(BusinessType.SERVICE);
      expect(cap.businessType).toBe(BusinessType.SERVICE);
      expect(cap.category).toBe('SERVICES');
      expect(cap.posMode).toBe('NONE');
      expect(cap.inventoryMode).toBe('NONE');
      expect(cap.enabledModules.pos).toBe(false);
      expect(cap.enabledModules.inventory).toBe(false);
      expect(cap.enabledModules.services).toBe(true);
      expect(cap.enabledModules.workOrders).toBe(true);
      expect(cap.enabledModules.quotations).toBe(true);
      expect(cap.terminology.itemLabel).toBe('Service Offering');
      expect(cap.terminology.customerLabel).toBe('Client');
      expect(cap.dashboardCapabilities.showFastBillingAction).toBe(false);
      expect(cap.dashboardCapabilities.showWorkOrdersWidget).toBe(true);
    });

    it('should provide complete capabilities for PHARMACY', () => {
      const cap = getBusinessTypeCapability(BusinessType.PHARMACY);
      expect(cap.businessType).toBe(BusinessType.PHARMACY);
      expect(cap.category).toBe('HEALTHCARE');
      expect(cap.posMode).toBe('FAST_BILLING');
      expect(cap.inventoryMode).toBe('BATCH_EXPIRY');
      expect(cap.enabledModules.pos).toBe(true);
      expect(cap.enabledModules.inventory).toBe(true);
      expect(cap.terminology.itemLabel).toBe('Medicine');
      expect(cap.terminology.customerLabel).toBe('Patient / Customer');
      expect(cap.dashboardCapabilities.showBatchExpiryWidget).toBe(true);
    });
  });

  describe('Fallback and Safety Behavior', () => {
    it('should default to RETAIL profile if null or undefined businessType is provided', () => {
      const capNull = getBusinessTypeCapability(null);
      const capUndef = getBusinessTypeCapability(undefined);
      expect(capNull.businessType).toBe(BusinessType.RETAIL);
      expect(capUndef.businessType).toBe(BusinessType.RETAIL);
    });

    it('should default to RETAIL profile if unknown string is provided', () => {
      const capUnknown = getBusinessTypeCapability('UNKNOWN_INDUSTRY' as any);
      expect(capUnknown.businessType).toBe(BusinessType.RETAIL);
    });

    it('should handle lowercase string inputs safely', () => {
      const capLower = getBusinessTypeCapability('restaurant' as any);
      expect(capLower.businessType).toBe(BusinessType.RESTAURANT);
    });
  });
});
