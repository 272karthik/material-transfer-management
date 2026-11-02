
import cds from '@sap/cds';

const { SELECT, UPDATE, INSERT } = cds.ql;

export default class MaterialTransferService extends cds.ApplicationService {
    async init() {
        const {
            Materials,
            Warehouses,
            StorageBins,
            Stocks,
            Transfers
        } = this.entities;

        // ==========================================
        // VALIDATE TRANSFER WHEN CREATING A REQUEST
        // ==========================================
        this.before('CREATE', Transfers, async (req) => {
            const data = req.data;

            // Validate source and destination fields
            if (
                !data.sourceWarehouse_ID ||
                !data.sourceBin_ID ||
                !data.destinationWarehouse_ID ||
                !data.destinationBin_ID
            ) {
                return req.error(
                    400,
                    'Source and destination are required.'
                );
            }

            // Source and destination bins must differ
            if (data.sourceBin_ID === data.destinationBin_ID) {
                return req.error(
                    400,
                    'Source and destination locations cannot be the same.'
                );
            }

            // Validate warehouses
            const sourceWarehouse = await SELECT.one
                .from(Warehouses)
                .where({ ID: data.sourceWarehouse_ID });

            const destinationWarehouse = await SELECT.one
                .from(Warehouses)
                .where({ ID: data.destinationWarehouse_ID });

            if (!sourceWarehouse || sourceWarehouse.status !== 'Active') {
                return req.error(
                    400,
                    'Source warehouse is inactive or missing.'
                );
            }

            if (
                !destinationWarehouse ||
                destinationWarehouse.status !== 'Active'
            ) {
                return req.error(
                    400,
                    'Destination warehouse is inactive or missing.'
                );
            }

            // Validate bins belong to their selected warehouses
            const sourceBin = await SELECT.one
                .from(StorageBins)
                .where({
                    ID: data.sourceBin_ID,
                    warehouse_ID: data.sourceWarehouse_ID
                });

            const destinationBin = await SELECT.one
                .from(StorageBins)
                .where({
                    ID: data.destinationBin_ID,
                    warehouse_ID: data.destinationWarehouse_ID
                });

            if (!sourceBin || sourceBin.status !== 'Active') {
                return req.error(
                    400,
                    'Source bin is inactive or missing.'
                );
            }

            if (!destinationBin || destinationBin.status !== 'Active') {
                return req.error(
                    400,
                    'Destination bin is inactive or missing.'
                );
            }

            // This version supports exactly one item per transfer
            const items = data.items || [];

            if (items.length !== 1) {
                return req.error(
                    400,
                    'A transfer must contain exactly one material item.'
                );
            }

            const item = items[0];
            const quantity = Number(item.quantity);

            if (!item.material_ID) {
                return req.error(400, 'Material is required.');
            }

            if (!Number.isFinite(quantity) || quantity <= 0) {
                return req.error(
                    400,
                    'Transfer quantity must be greater than zero.'
                );
            }

            // Validate material
            const material = await SELECT.one
                .from(Materials)
                .where({ ID: item.material_ID });

            if (!material || material.status !== 'Active') {
                return req.error(
                    400,
                    'Material is inactive or missing.'
                );
            }

            if (item.unit !== material.baseUnit) {
                return req.error(
                    400,
                    'Transfer unit must match the material base unit.'
                );
            }

            // EA and BOX quantities must be whole numbers
            if (
                ['EA', 'BOX'].includes(material.baseUnit) &&
                !Number.isInteger(quantity)
            ) {
                return req.error(
                    400,
                    'This material requires a whole-number quantity.'
                );
            }

            // Validate available stock at the source bin
            const stock = await SELECT.one
                .from(Stocks)
                .where({
                    material_ID: item.material_ID,
                    warehouse_ID: data.sourceWarehouse_ID,
                    bin_ID: data.sourceBin_ID
                });

            if (
                !stock ||
                Number(stock.availableQuantity) < quantity
            ) {
                return req.error(
                    400,
                    'Insufficient available stock.'
                );
            }

            // Save source available stock as a request-time snapshot
            item.sourceAvailableStock = Number(stock.availableQuantity);

            // Validate destination capacity
            if (destinationBin.capacity != null) {
                const occupancy = Number(
                    destinationBin.currentOccupancy || 0
                );

                if (
                    occupancy + quantity >
                    Number(destinationBin.capacity)
                ) {
                    return req.error(
                        400,
                        'Destination bin does not have sufficient capacity.'
                    );
                }
            }

            // Temporary demo numbering; not concurrency-safe
            const year = new Date().getFullYear();
            const existing = await SELECT.from(Transfers);
            const nextNumber = existing.length + 1;

            data.transferNumber =
                `TR-${year}-${String(nextNumber).padStart(6, '0')}`;

            data.requestDate = new Date().toISOString();
            data.status = 'Requested';
        });

        // ==========================================
        // APPROVE A TRANSFER REQUEST
        // ==========================================
        this.on('approve', Transfers, async (req) => {
            const { ID, approvedBy } = req.data;

            if (!ID) {
                return req.error(400, 'Transfer ID is required.');
            }

            if (
                typeof approvedBy !== 'string' ||
                !approvedBy.trim()
            ) {
                return req.error(400, 'Approver name is required.');
            }

            const transfer = await SELECT.one
                .from(Transfers)
                .where({ ID });

            if (!transfer) {
                return req.error(404, 'Transfer not found.');
            }

            if (transfer.status !== 'Requested') {
                return req.error(
                    400,
                    'Only Requested transfers can be approved.'
                );
            }

            const approvalDate = new Date().toISOString();
            const approver = approvedBy.trim();

            await UPDATE(Transfers)
                .set({
                    status: 'Approved',
                    approvedBy: approver,
                    approvalDate
                })
                .where({ ID });

            // Create audit entry
            await INSERT.into('materialtransfer.TransferAuditLogs').entries({
                ID: cds.utils.uuid(),
                transfer_ID: ID,
                action: 'APPROVED',
                oldStatus: 'Requested',
                newStatus: 'Approved',
                performedBy: approver,
                performedAt: approvalDate,
                details: 'Transfer request approved.'
            });

            return SELECT.one
                .from(Transfers)
                .where({ ID });
        });

        return super.init();
    }
}
