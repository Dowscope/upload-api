const express = require("express");


module.exports = function register({ pool_main }) {
  const router = express.Router();
  // *********************************
  // FORUM - Get Categories
  // *********************************
  router.get('/api/forum/getCategories', async function(req, res) {
    let db = pool_main;

    let { isCategory, catId } = req.query;
    let cat = catId
    if (cat === null || cat === undefined) {
      cat = 0;
    }
    if (isCategory === null || isCategory === undefined) {
      return res.status(400).json({ error: `isCategory is required: ${isCategory}` });
    }
    isCategory = isCategory.toLowerCase() === 'true';
    let query = 'SELECT fc.cat_id, fc.name, fc.description, fc.parent_id, (SELECT COUNT(*) FROM forum_topics ft WHERE ft.cat_id = fc.cat_id) AS "topic_count" FROM forum_category fc WHERE fc.parent_id = ?';
    let qryLastPost = `SELECT final.cat_id, final.title, final.user, MAX(final.date_posted) AS "date" FROM ( SELECT fc.cat_id, ft.title, CONCAT(u.first_name, ' ', u.last_name) AS "user", fp.date_posted FROM forum_category fc JOIN forum_topics ft ON ft.cat_id = fc.cat_id JOIN forum_posts fp ON fp.topic_id = ft.topic_id JOIN USERS u ON u.userid = fp.user_id ) final GROUP BY final.cat_id, final.title, final.user`;
    if (!isCategory) {
      query = 'SELECT ft.topic_id, ft.title, ft.description, ft.cat_id, (SELECT COUNT(*) FROM forum_posts fp WHERE fp.topic_id = ft.topic_id) AS "post_count" FROM forum_topics ft WHERE ft.cat_id = ?';
      qryLastPost = `SELECT final.topic_id, final.title, final.user, MAX(final.date_posted) AS "date", final.cat_id FROM ( SELECT ft.cat_id, ft.topic_id, ft.title, CONCAT(u.first_name, ' ', u.last_name) AS "user", fp.date_posted FROM forum_topics ft JOIN forum_posts fp ON fp.topic_id = ft.topic_id JOIN USERS u ON u.userid = fp.user_id ) final GROUP BY final.topic_id, final.title, final.user,final.cat_id`;
    }
    db.query(query, [cat], async (err, results) => {
      if (err) {
        console.error("Query Error: ", err);
        return res.status(500).json({ error: 'Query Failed' });
      }

      if (results.length > 0) {
        db.query(qryLastPost, [cat], (errlp, lastPostResults) => {
          if (err) {
            console.error("Query Error: ", errlp);
            return res.status(500).json({ error: 'Query last post Failed' });
          }
          return res.json({success: true, objects: results, lastpost: lastPostResults});
        });
      } else {
        return res.status(401).json({ error: 'No Categories Found' });
      }
    });
  });

  // *********************************
  // FORUM - Get Topics
  // *********************************
  router.get('/api/forum/getTopics', async function(req, res) {
    let db = pool_main;

    const { topicId } = req.query;
    console.log(`Getting Topics for: ${topicId}`);

    if (topicId === null || topicId === undefined) {
      return res.status(400).json({ success: false, error: `topic is required` });
    }

    const query = 'SELECT fp.post_id, fp.message, fp.topic_id, fp.date_posted, fp.user_id, CONCAT(u.first_name, \' \', u.last_name) as "user" FROM forum_posts fp JOIN USERS u ON u.userid = fp.user_id WHERE topic_id = ?';

    db.query(query, [topicId], async (err, results) => {
      if (err) {
        console.error("Query Error: ", err);
        return res.status(500).json({ success: false, error: 'Query Failed' });
      }

      if (results.length > 0) {
        return res.json({success: true, objects: results});
      } else {
        return res.status(401).json({ success: false, error: 'No Categories Found' });
      }
    });
  });
  return router;
};
