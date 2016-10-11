package edu.jhu.hlt.cadet.retriever;

import static org.hamcrest.CoreMatchers.is;
import static org.junit.Assert.assertThat;
import static org.junit.Assert.fail;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.apache.thrift.TException;
import org.junit.Ignore;
import org.junit.Test;

import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;

import edu.jhu.hlt.cadet.search.MockSearchProvider;
import edu.jhu.hlt.concrete.access.FetchRequest;
import edu.jhu.hlt.concrete.access.FetchResult;
import edu.jhu.hlt.concrete.search.SearchQuery;
import edu.jhu.hlt.concrete.search.SearchResult;

public class ScionRetrieveTest {

    @Test
    @Ignore
    public void testToRetrieveComms() {

        try {
            SearchQuery query = new SearchQuery();
            query.setTerms(new ArrayList<String>());
            query.setQuestions(null);
            query.setRawQuery("This is a sentence");

            Config config = ConfigFactory.load();
            MockSearchProvider mocker = new MockSearchProvider();
            mocker.init(config);
            ScionRetrieverProvider retriever = new ScionRetrieverProvider();
            retriever.init(config);

            Iterator<SearchResult> resultIter = mocker.search(query).getSearchResultsIterator();

            List<String> commIdList = new ArrayList<>();
            while (resultIter.hasNext()) {
                String commId = resultIter.next().getCommunicationId();
                commIdList.add(commId);
            }

            FetchRequest request = new FetchRequest(commIdList);
            FetchResult results = retriever.fetch(request);

            assertThat(commIdList.size(), is(results.getCommunications().size()));
        } catch (TException e) {
            fail("Thrift exception thrown");
        }
    }
}
