# upload-api

SELECT 
	ft.title,
    CONCAT(u.first_name, ' ',u.last_name) AS "user",
    fp.date_posted
FROM forum_category fc 
JOIN forum_topics ft ON ft.cat_id = fc.cat_id 
JOIN forum_posts fp ON fp.topic_id = ft.topic_id 
JOIN USERS u ON u.userid = fp.user_id; 
