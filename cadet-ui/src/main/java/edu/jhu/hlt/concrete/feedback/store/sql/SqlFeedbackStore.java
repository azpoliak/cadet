package edu.jhu.hlt.concrete.feedback.store.sql;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.hibernate.Query;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.Transaction;
import org.hibernate.cfg.Configuration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.typesafe.config.Config;

import edu.jhu.hlt.concrete.UUID;
import edu.jhu.hlt.concrete.feedback.store.CommunicationFeedback;
import edu.jhu.hlt.concrete.feedback.store.FeedbackException;
import edu.jhu.hlt.concrete.feedback.store.FeedbackQuery;
import edu.jhu.hlt.concrete.feedback.store.FeedbackStore;
import edu.jhu.hlt.concrete.feedback.store.SentenceFeedback;
import edu.jhu.hlt.concrete.feedback.store.SentenceIdentifier;
import edu.jhu.hlt.concrete.search.SearchFeedback;
import edu.jhu.hlt.concrete.search.SearchResults;
import edu.jhu.hlt.concrete.search.SearchType;
import edu.jhu.hlt.concrete.util.ConcreteException;

public class SqlFeedbackStore implements FeedbackStore {
    private static Logger logger = LoggerFactory.getLogger(SqlFeedbackStore.class);

    private SessionFactory sessionFactory;
    // TODO replace with LRU cache
    private Map<UUID, FeedbackRecord> cache = new HashMap<UUID, FeedbackRecord>();

    @Override
    public void init(Config config) {
        config = config.getConfig("servlets.feedback");
        Configuration dbConfig = new Configuration()
                .setProperty("hibernate.dialect", config.getString("hibernate.dialect"))
                .setProperty("hibernate.connection.driver_class", config.getString("hibernate.connection.driver_class"))
                .setProperty("hibernate.connection.url", config.getString("hibernate.connection.url"))
                .addAnnotatedClass(Feedback.class)
                .addAnnotatedClass(FeedbackRecord.class);
        updateConfig(dbConfig, config, "hibernate.connection.username");
        updateConfig(dbConfig, config, "hibernate.connection.password");
        updateConfig(dbConfig, config, "hibernate.hbm2ddl.auto", "validate");
        sessionFactory = dbConfig.buildSessionFactory();
    }

    private void updateConfig(Configuration dbConfig, Config config, String option) {
        updateConfig(dbConfig, config, option, null);
    }

    private void updateConfig(Configuration dbConfig, Config config, String option, String fallback) {
        if (config.hasPath(option)) {
            dbConfig.setProperty(option, config.getString(option));
        } else if (fallback != null) {
            dbConfig.setProperty(option, fallback);
        }
    }

    public void close() {
        sessionFactory.close();
    }

    @Override
    public void addSearchResults(SearchResults results) throws ConcreteException {
        FeedbackRecord record = FeedbackRecord.create(results);
        Session session = sessionFactory.openSession();
        session.beginTransaction();
        session.save(record);
        session.getTransaction().commit();
        session.close();
        cache.put(results.getUuid(), record);
        logger.debug("SearchResults stored in db");
    }

    @Override
    public void addFeedback(UUID uuid, String communicationId, SearchFeedback feedback)
                    throws FeedbackException {
        addFeedback(uuid, communicationId, null, feedback);
    }

    @Override
    public void addFeedback(UUID uuid, String communicationId, UUID sentenceId,
                    SearchFeedback feedback) throws FeedbackException {
        String sentIdString = null;
        if (sentenceId != null) {
            sentIdString = sentenceId.getUuidString();
        }
        FeedbackRecord record = cache.get(uuid);
        Feedback item = record.getFeedbackItem(communicationId, sentIdString);
        item.setValue(feedback);
        Session session = sessionFactory.openSession();
        session.beginTransaction();
        session.update(item);
        session.getTransaction().commit();
        session.close();
        logger.debug("Feedback updated in db");
    }

    @Override
    public Map<String, SearchFeedback> getCommunicationFeedback(UUID uuid) {
        Map<String, SearchFeedback> map = new HashMap<>();

        FeedbackRecord record = getFeedbackRecord(uuid, SearchType.COMMUNICATIONS);
        if (record != null) {
            for (Feedback feedback : record.getFeedback()) {
                map.put(feedback.getCommId(), feedback.getValue());
            }
        }

        return map;
    }

    @Override
    public Map<SentenceIdentifier, SearchFeedback> getSentenceFeedback(UUID uuid) {
        Map<SentenceIdentifier, SearchFeedback> map = new HashMap<>();

        FeedbackRecord record = getFeedbackRecord(uuid, SearchType.SENTENCES);
        if (record != null) {
            for (Feedback fb : record.getFeedback()) {
                SentenceIdentifier id = new SentenceIdentifier(fb.getCommId(), new UUID(fb.getSentId()));
                map.put(id, fb.getValue());
            }
        }

        return map;
    }

    private FeedbackRecord getFeedbackRecord(UUID uuid, SearchType searchType) {
        Session session = sessionFactory.openSession();
        Transaction trans = session.beginTransaction();
        Query query = session.createQuery("from FeedbackRecord where uuid = :uuid and searchType = :type");
        query.setParameter("uuid", uuid.getUuidString());
        query.setParameter("type", searchType);
        FeedbackRecord record = (FeedbackRecord) query.uniqueResult();
        trans.commit();
        session.close();
        return record;
    }

    @Override
    public Set<CommunicationFeedback> queryCommunicationFeedback(FeedbackQuery query) {
        Session session = sessionFactory.openSession();
        session.beginTransaction();
        Query hql = buildQuery(session, query, SearchType.COMMUNICATIONS);
        @SuppressWarnings("unchecked")
        List<FeedbackRecord> records = hql.list();
        Set<CommunicationFeedback> data = new HashSet<CommunicationFeedback>();
        for (FeedbackRecord record : records) {
            CommunicationFeedback cf = createCommunicationFeedback(record);
            if (cf != null) {
                data.add(cf);
            }
        }

        session.getTransaction().commit();
        session.close();
        return data;
    }

    @Override
    public Set<SentenceFeedback> querySentenceFeedback(FeedbackQuery query) {
        Session session = sessionFactory.openSession();
        session.beginTransaction();
        Query hql = buildQuery(session, query, SearchType.SENTENCES);
        @SuppressWarnings("unchecked")
        List<FeedbackRecord> records = hql.list();
        Set<SentenceFeedback> data = new HashSet<SentenceFeedback>();
        for (FeedbackRecord record : records) {
            SentenceFeedback sf = createSentenceFeedback(record);
            if (sf != null) {
                data.add(sf);
            }
        }

        session.getTransaction().commit();
        session.close();
        return data;
    }

    private Query buildQuery(Session session, FeedbackQuery query, SearchType searchType) {
        String hql = "from FeedbackRecord where searchType = :type and (:ts_start is null or timestamp > :ts_start)" 
                        + " and (:ts_stop is null or timestamp < :ts_stop)";
        if (query.getUserNames() != null) {
            hql += " and userId in (:users)";
        }
        if (query.getQueryNames() != null) {
            hql += " and queryName in (:names)";
        }
        // TODO labels

        Query q = session.createQuery(hql)
                .setParameter("ts_start", query.getStartDate())
                .setParameter("ts_stop", query.getEndDate())
                .setParameter("type", searchType);
        if (query.getUserNames() != null) {
            q.setParameterList("users", query.getUserNames());
        }
        if (query.getQueryNames() != null) {
            q.setParameterList("names", query.getQueryNames());
        }
        if (query.getLimit() != FeedbackQuery.NO_LIMIT) {
            q.setMaxResults(query.getLimit());
        }

        return q;
    }

    @Override
    public Set<CommunicationFeedback> getAllCommunicationFeedback() {
        Session session = sessionFactory.openSession();
        Transaction trans = session.beginTransaction();
        List<FeedbackRecord> records = getAllRecords(session, SearchType.COMMUNICATIONS);
        Set<CommunicationFeedback> data = new HashSet<CommunicationFeedback>();
        for (FeedbackRecord record : records) {
            CommunicationFeedback cf = createCommunicationFeedback(record);
            if (cf != null) {
                data.add(cf);
            }
        }

        trans.commit();
        session.close();

        return data;
    }

    @Override
    public Set<SentenceFeedback> getAllSentenceFeedback() {
        Session session = sessionFactory.openSession();
        Transaction trans = session.beginTransaction();
        List<FeedbackRecord> records = getAllRecords(session, SearchType.SENTENCES);
        Set<SentenceFeedback> data = new HashSet<SentenceFeedback>();
        for (FeedbackRecord record : records) {
            SentenceFeedback sf = createSentenceFeedback(record);
            if (sf != null) {
                data.add(sf);
            }
        }

        trans.commit();
        session.close();

        return data;
    }

    @SuppressWarnings("unchecked")
    private List<FeedbackRecord> getAllRecords(Session session, SearchType type) {
        Query query = session.createQuery("from FeedbackRecord where searchType = :value");
        query.setParameter("value", type);
        return query.list();
    }

    private SentenceFeedback createSentenceFeedback(FeedbackRecord record) {
        SentenceFeedback sf = null;
        try {
            sf = new SentenceFeedback(record.getSearchResults());
            for (Feedback fb : record.getFeedback()) {
                sf.addFeedback(fb.getCommId(), new UUID(fb.getSentId()), fb.getValue());
            }
        } catch (ConcreteException | FeedbackException e) {
            // likely deserializing old data
            logger.error("Likely deserializing incompatible thrift object for feedback", e);
        }
        return sf;
    }

    private CommunicationFeedback createCommunicationFeedback(FeedbackRecord record) {
        CommunicationFeedback cf = null;
        try {
            cf = new CommunicationFeedback(record.getSearchResults());
            for (Feedback fb : record.getFeedback()) {
                cf.addFeedback(fb.getCommId(), fb.getValue());
            }
        } catch (ConcreteException | FeedbackException e) {
            // likely deserializing old data
            logger.error("Likely deserializing incompatible thrift object for feedback", e);
        }
        return cf;
    }
}
