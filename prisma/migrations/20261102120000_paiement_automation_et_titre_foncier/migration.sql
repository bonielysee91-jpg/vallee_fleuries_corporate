-- =========================================================================
-- Migration VFC : sécurité foncière, frais de dossier agence,
-- journal des échecs de paiement et automation de clôture des biens.
--
-- Partie 1 : DDL généré par `prisma migrate diff` (aligné sur schema.prisma).
-- Partie 2 : fonction + trigger PostgreSQL « trigger_alerte_fonds », qui ne
--            peuvent pas être exprimés dans le schéma Prisma.
-- Le catalogue d'images reste porté par la relation PropertyImage (pas de TEXT[]).
-- =========================================================================

-- CreateEnum
CREATE TYPE "LandTitleType" AS ENUM ('TITRE_FONCIER', 'ACD', 'CERTIFICAT_FONCIER', 'CONTRAT_BAIL', 'NON_COMMUNIQUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionStatus" ADD VALUE 'INSUFFICIENT_FUNDS';
ALTER TYPE "TransactionStatus" ADD VALUE 'TECHNICAL_ERROR';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "agencyFileFeeFcfa" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "landTitleType" "LandTitleType" NOT NULL DEFAULT 'NON_COMMUNIQUE';

-- CreateTable
CREATE TABLE "PaymentErrorLog" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "propertyId" TEXT,
    "payerPhone" TEXT,
    "detail" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentErrorLog_transactionId_idx" ON "PaymentErrorLog"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentErrorLog_propertyId_idx" ON "PaymentErrorLog"("propertyId");

-- CreateIndex
CREATE INDEX "PaymentErrorLog_isResolved_occurredAt_idx" ON "PaymentErrorLog"("isResolved", "occurredAt");

-- AddForeignKey
ALTER TABLE "PaymentErrorLog" ADD CONSTRAINT "PaymentErrorLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentErrorLog" ADD CONSTRAINT "PaymentErrorLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================================
-- LOGIQUE DYNAMIQUE : détection des comptes sans provisions + verrouillage du bien
-- (équivalent Prisma du trigger « trigger_alerte_fonds »)
-- =========================================================================

CREATE OR REPLACE FUNCTION "verifier_statut_transaction"()
RETURNS TRIGGER AS $$
BEGIN
    -- CAS 1 : Détection instantanée d'un compte / portefeuille sans fonds
    IF NEW."status" = 'INSUFFICIENT_FUNDS' THEN
        INSERT INTO "PaymentErrorLog" ("id", "transactionId", "propertyId", "payerPhone", "detail")
        VALUES (
            gen_random_uuid()::text,
            NEW."id",
            NEW."propertyId",
            NEW."payerPhone",
            CONCAT(
                'ALERTE TENTATIVE DE FRAUDE / COMPTE VIDE : Le client ', NEW."payerName",
                ' (Tél: ', NEW."payerPhone", ') a tenté un paiement de ', NEW."amountFcfa",
                ' FCFA via ', NEW."paymentMethod",
                ' mais la transaction a échoué pour motif : SOLDE INSUFFISANT.'
            )
        );

    -- CAS 2 : Le paiement a abouti et l'argent est sécurisé
    ELSIF NEW."status" = 'SUCCESSFUL' THEN
        -- Verrouillage immédiat du bien pour empêcher une double location
        UPDATE "Property"
        SET "status" = 'RENTED'
        WHERE "id" = NEW."propertyId";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trigger_alerte_fonds"
AFTER INSERT OR UPDATE ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION "verifier_statut_transaction"();
