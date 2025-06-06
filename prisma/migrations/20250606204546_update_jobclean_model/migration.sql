-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('YEAR', 'MONTH', 'WEEK', 'DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('REMOTE', 'ON_SITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'CONTRACT', 'PART_TIME', 'TEMPORARY', 'INTERNSHIP', 'VOLUNTEER', 'OTHER');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('ENTRY', 'ASSOCIATE', 'MID_SENIOR', 'DIRECTOR', 'EXECUTIVE', 'INTERNSHIP', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ExperienceCategory" AS ENUM ('Y0_1', 'Y1_3', 'Y3_5', 'Y5P');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('NONE', 'HIGH_SCHOOL', 'BACHELOR', 'MASTER', 'PHD');

-- CreateEnum
CREATE TYPE "SalaryCurrency" AS ENUM ('USD', 'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'FOK', 'GBP', 'GEL', 'GGP', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS', 'IMP', 'INR', 'IQD', 'IRR', 'ISK', 'JEP', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KID', 'KMF', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TVD', 'TWD', 'TZS', 'UAH', 'UGX', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XDR', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL');

-- CreateTable
CREATE TABLE "JobClean" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "refId" TEXT,
    "jobUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleClass" TEXT,
    "companyName" TEXT,
    "companyId" TEXT,
    "companyUrl" TEXT,
    "country" CHAR(2),
    "region" TEXT,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" "SalaryCurrency",
    "salaryPeriod" "SalaryPeriod",
    "salaryUsdYearMin" DOUBLE PRECISION,
    "salaryUsdYearMax" DOUBLE PRECISION,
    "postedAt" TIMESTAMP(3),
    "applicantsCount" INTEGER,
    "applicantsIsCapped" BOOLEAN NOT NULL DEFAULT false,
    "platform" TEXT NOT NULL DEFAULT 'linkedin',
    "workplaceType" "WorkplaceType" NOT NULL DEFAULT 'ON_SITE',
    "employmentType" "EmploymentType" NOT NULL,
    "seniority" "Seniority",
    "experienceCategory" "ExperienceCategory",
    "jobFunction" TEXT,
    "industries" TEXT,
    "educationRequired" "EducationLevel",
    "mandatoryTech" TEXT[],
    "niceToHaveTech" TEXT[],
    "softSkills" TEXT[],
    "certificatesRequired" TEXT[],
    "benefits" TEXT[],
    "languages" TEXT[],
    "timezoneRestriction" INTEGER[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobClean_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobClean_jobId_key" ON "JobClean"("jobId");
