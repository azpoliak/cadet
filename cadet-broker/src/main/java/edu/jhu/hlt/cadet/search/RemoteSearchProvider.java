package edu.jhu.hlt.cadet.search;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.apache.thrift.TException;
import org.apache.thrift.protocol.TCompactProtocol;
import org.apache.thrift.transport.TSocket;
import org.apache.thrift.transport.TFramedTransport;

import com.typesafe.config.Config;

import edu.jhu.hlt.cadet.CadetConfig;
import edu.jhu.hlt.concrete.search.SearchCapability;
import edu.jhu.hlt.concrete.search.SearchService;
import edu.jhu.hlt.concrete.search.SearchQuery;
import edu.jhu.hlt.concrete.search.SearchResult;
import edu.jhu.hlt.concrete.services.ServiceInfo;
import edu.jhu.hlt.concrete.services.ServicesException;

/**
 * Submits queries against a remote service that implements the Search thrift service
 */
public class RemoteSearchProvider implements SearchProvider {
    private static Logger logger = LoggerFactory.getLogger(RemoteSearchProvider.class);

    private String host;
    private int port;

    private TFramedTransport transport;
    private TCompactProtocol protocol;
    private SearchService.Client client;

    @Override
    public void init(Config config) {
        logger.info("Using custom SearchProvider settings");
        init(config.getString(CadetConfig.SEARCH_HOST_CUSTOM),
             config.getInt(CadetConfig.SEARCH_PORT_CUSTOM));
    }

    public void init(String h, int p) {
        host = h;
        port = p;

        logger.info("SearchHandler HOST: " + host);
        logger.info("SearcheHandler PORT: " + port);

        transport = new TFramedTransport(new TSocket(host, port), Integer.MAX_VALUE);
        protocol = new TCompactProtocol(transport);
        client = new SearchService.Client(protocol);
    }

    @Override
    public void close() {
        if (transport.isOpen()) {
            transport.close();
        }
    }

    @Override
    public SearchResult search(SearchQuery searchQuery) throws ServicesException, TException {
        SearchResult results = null;

        if (!transport.isOpen()) {
            transport.open();
        }
        results = client.search(searchQuery);

        if (results == null) {
            throw new ServicesException("Invalid results from search provider");
        }

        return results;
    }

    @Override
    public boolean alive() throws TException {
        if (!transport.isOpen()) {
            transport.open();
        }
        boolean result = client.alive();
        return result;
    }

    @Override
    public ServiceInfo about() throws TException {
        if (!transport.isOpen()) {
            transport.open();
        }
        ServiceInfo info = client.about();
        return info;
    }

    @Override
    public List<SearchCapability> getCapabilities() throws ServicesException, TException {
        if (!transport.isOpen()) {
            transport.open();
        }
        List<SearchCapability> capabilities = client.getCapabilities();
        return capabilities;
    }

    @Override
    public List<String> getCorpora() throws ServicesException, TException {
        if (!transport.isOpen()) {
            transport.open();
        }
        List<String> corpora = client.getCorpora();
        return corpora;
    }
}
