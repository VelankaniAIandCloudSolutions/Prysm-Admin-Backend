CREATE PROCEDURE [dbo].[sp_Get_Orders_Detailed]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        o.*,
        ua.email AS user_email, ua.first_name AS user_first_name, ua.last_name AS user_last_name,
        ub.email AS created_by_email, ub.first_name AS created_by_first_name, ub.last_name AS created_by_last_name,
        uc.email AS updated_by_email, ub.first_name AS updated_by_first_name, ub.last_name AS updated_by_last_name
    FROM
        [dbo].[order_info] o
        LEFT JOIN
        [dbo].[mas_user_account] ua ON o.user_account_id = ua.id
        LEFT JOIN
        [dbo].[mas_user_account] ub ON o.created_by_id = ub.id
        LEFT JOIN
        [dbo].[mas_user_account] uc ON o.updated_by_id = uc.id

-- WITH (NOLOCK);
END;