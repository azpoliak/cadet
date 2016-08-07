package edu.jhu.hlt.cadet.retriever;

import org.apache.thrift.TException;

import com.typesafe.config.Config;

import edu.jhu.hlt.concrete.Communication;
import edu.jhu.hlt.concrete.Section;
import edu.jhu.hlt.concrete.section.SectionFactory;
import edu.jhu.hlt.concrete.Sentence;
import edu.jhu.hlt.concrete.sentence.SentenceFactory;
import edu.jhu.hlt.concrete.TextSpan;
import edu.jhu.hlt.concrete.Tokenization;
import edu.jhu.hlt.concrete.access.RetrieveRequest;
import edu.jhu.hlt.concrete.access.RetrieveResults;
import edu.jhu.hlt.concrete.random.RandomConcreteFactory;
import edu.jhu.hlt.concrete.services.ServiceInfo;
import edu.jhu.hlt.concrete.services.ServicesException;
import edu.jhu.hlt.concrete.util.ConcreteException;
import edu.jhu.hlt.concrete.uuid.AnalyticUUIDGeneratorFactory;
import edu.jhu.hlt.concrete.uuid.AnalyticUUIDGeneratorFactory.AnalyticUUIDGenerator;
import edu.jhu.hlt.tift.Tokenizer;

/**
 * Generates mock communications for testing, debugging, and development
 */
public class MockRetrieverProvider implements RetrieverProvider {

    @Override
    public void init(Config config) {}

    @Override
    public void close() {}

    @Override
    public RetrieveResults retrieve(RetrieveRequest request) throws ServicesException, TException {
        RetrieveResults results = new RetrieveResults();
        RandomConcreteFactory factory = new RandomConcreteFactory();
        NonsenseGenerator gen = NonsenseGenerator.getInstance();
        for (String commId : request.getCommunicationIds()) {
            Communication comm = factory.communication();
            AnalyticUUIDGeneratorFactory f = new AnalyticUUIDGeneratorFactory(comm);
            AnalyticUUIDGenerator uuidGen = f.create();

            String text = gen.makeHeadline();
            comm.setText(text);
            comm.setId(commId);

            TextSpan ts = new TextSpan(0, text.length());
            try {
                Section section = new SectionFactory(uuidGen).fromTextSpan(ts, "passage");
                Sentence sentence = new SentenceFactory(uuidGen).create();
                sentence.setTextSpan(ts);
                Tokenization tokenization = Tokenizer.WHITESPACE.tokenizeToConcrete(text, 0);
                sentence.setTokenization(tokenization);
                section.addToSentenceList(sentence);
                comm.addToSectionList(section);
            } catch (ConcreteException e) {
                throw new ServicesException();
            }

            results.addToCommunications(comm);
        }

        return results;
    }

    @Override
    public boolean alive() throws TException {
        return true;
    }

    @Override
    public ServiceInfo about() throws TException {
        return new ServiceInfo(this.getClass().getSimpleName(), "1.0.0");
    }

}