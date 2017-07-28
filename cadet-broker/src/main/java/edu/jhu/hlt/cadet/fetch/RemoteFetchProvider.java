package edu.jhu.hlt.cadet.fetch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import org.apache.thrift.TException;
import org.apache.thrift.protocol.TCompactProtocol;
import org.apache.thrift.transport.TFramedTransport;
import org.apache.thrift.transport.TSocket;

import com.typesafe.config.Config;

import edu.jhu.hlt.cadet.CadetConfig;
import edu.jhu.hlt.concrete.access.FetchRequest;
import edu.jhu.hlt.concrete.access.FetchResult;
import edu.jhu.hlt.concrete.access.FetchCommunicationService;
import edu.jhu.hlt.concrete.services.NotImplementedException;
import edu.jhu.hlt.concrete.services.ServiceInfo;
import edu.jhu.hlt.concrete.services.ServicesException;

/**
 * Fetch documents from a remote service that implements the FetchCommunicationService thrift service
 */
public class RemoteFetchProvider implements FetchProvider {
    private static Logger logger = LoggerFactory.getLogger(RemoteFetchProvider.class);

    private String host;
    private int port;

    private TFramedTransport transport;
    private TCompactProtocol protocol;
    private FetchCommunicationService.Client client;

    private Object clientLock = new Object();

    @Override
    public void init(Config config) {
        host = config.getString(CadetConfig.FETCH_HOST);
        port = config.getInt(CadetConfig.FETCH_PORT);

        logger.info("RemoteFetchProvider HOST: " + host);
        logger.info("RemoteFetchProvider PORT: " + port);

        transport = new TFramedTransport(new TSocket(host, port), Integer.MAX_VALUE);
        protocol = new TCompactProtocol(transport);
        client = new FetchCommunicationService.Client(protocol);
    }

    @Override
    public void close() {
        if (transport.isOpen()) {
            transport.close();
        }
    }

    @Override
    public FetchResult fetch(FetchRequest request) throws ServicesException, TException {
        if (!transport.isOpen()) {
            transport.open();
        }

        FetchResult results = null;
        synchronized(clientLock) {
            results = client.fetch(request);
        }

        return results;
    }

    @Override
    public long getCommunicationCount() throws NotImplementedException, TException {
        if (!transport.isOpen()) {
            transport.open();
        }
        long count = client.getCommunicationCount();
        return count;
    }

    @Override
    public List<String> getCommunicationIDs(long offset, long count) throws NotImplementedException, TException {
        if (!transport.isOpen()) {
            transport.open();
        }
        List<String> ids = client.getCommunicationIDs(offset, count);
        return ids;
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

}
