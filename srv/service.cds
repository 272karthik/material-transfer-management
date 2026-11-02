using materialtransfer from '../db/schema';

@path: '/material-transfer'
service MaterialTransferService {
    entity Materials         as projection on materialtransfer.Materials;
    entity Warehouses        as projection on materialtransfer.Warehouses;
    entity StorageBins       as projection on materialtransfer.StorageBins;
    entity Stocks            as projection on materialtransfer.Stocks;

    entity Transfers         as projection on materialtransfer.Transfers
        actions {
            action approve(approvedBy: String(100)) returns Transfers;
        };

    entity TransferItems     as projection on materialtransfer.TransferItems;
    entity TransferAuditLogs as projection on materialtransfer.TransferAuditLogs;
}
