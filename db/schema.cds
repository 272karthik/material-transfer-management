
namespace materialtransfer;

using { cuid, managed } from '@sap/cds/common';

entity Materials : cuid, managed {
    materialID   : String(20) not null;
    materialName : String(100) not null;
    materialType : String(30) not null;
    baseUnit     : String(5) not null;
    status       : String(10) default 'Active';
}

entity Warehouses : cuid, managed {
    warehouseID   : String(20) not null;
    warehouseName : String(100) not null;
    location      : String(100);
    address       : String(255);
    status        : String(10) default 'Active';
}

entity StorageBins : cuid, managed {
    warehouse     : Association to Warehouses not null;
    binNumber     : String(20) not null;
    binType       : String(30);
    capacity      : Decimal(15, 3);
    currentOccupancy : Decimal(15, 3) default 0;
    status        : String(10) default 'Active';
}

entity Stocks : cuid, managed {
    material          : Association to Materials not null;
    warehouse         : Association to Warehouses not null;
    bin               : Association to StorageBins not null;
    availableQuantity : Decimal(15, 3) default 0;
    reservedQuantity  : Decimal(15, 3) default 0;
    totalQuantity     : Decimal(15, 3) default 0;
    unit              : String(5) not null;
}

entity Transfers : cuid, managed {
    transferNumber       : String(30) not null;
    requestDate          : Timestamp;
    requestedBy          : String(100);
    sourceWarehouse      : Association to Warehouses not null;
    sourceBin            : Association to StorageBins not null;
    destinationWarehouse : Association to Warehouses not null;
    destinationBin       : Association to StorageBins not null;
    status               : String(15) default 'Requested';
    transferDate         : Timestamp;
    approvedBy           : String(100);
    approvalDate         : Timestamp;
    transferredBy        : String(100);
    cancellationReason   : String(500);
    remarks              : String(500);

    items : Composition of many TransferItems
        on items.transfer = $self;
}

entity TransferItems : cuid {
    transfer            : Association to Transfers not null;
    material             : Association to Materials not null;
    quantity              : Decimal(15, 3) not null;
    unit                  : String(5) not null;
    sourceAvailableStock  : Decimal(15, 3);
    remarks               : String(500);
}

entity TransferAuditLogs : cuid {
    transfer    : Association to Transfers not null;
    action      : String(30) not null;
    oldStatus   : String(15);
    newStatus   : String(15);
    performedBy : String(100);
    performedAt : Timestamp;
    details     : String(500);
}
