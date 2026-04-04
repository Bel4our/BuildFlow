IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'BuildFlowDB')
BEGIN
    CREATE DATABASE BuildFlowDB;
END
GO

USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'BuildFlowAppUser')
BEGIN
    CREATE LOGIN BuildFlowAppUser WITH PASSWORD = 'buildflowpassword';
END
GO

USE BuildFlowDB;
GO

IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'BuildFlowAppUser')
BEGIN
    CREATE USER BuildFlowAppUser FOR LOGIN BuildFlowAppUser;
END
GO


ALTER ROLE db_owner ADD MEMBER BuildFlowAppUser;
GO