import asyncio
import logging
from pysnmp.hlapi.v3arch.asyncio import (
    SnmpEngine,
    CommunityData,
    UdpTransportTarget,
    ContextData,
    ObjectType,
    ObjectIdentity,
    get_cmd,
    next_cmd,
)

logger = logging.getLogger(__name__)

async def snmp_get(ip: str, oid: str, community: str = 'public', port: int = 161):
    transport = None
    try:
        transport = await UdpTransportTarget.create((ip, port))
        errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
            SnmpEngine(),
            CommunityData(community, mpModel=1),
            transport,
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
        )

        if errorIndication:
            logger.error(f"SNMP GET Error: {errorIndication}")
            return None
        if errorStatus:
            logger.error(f"SNMP GET Error: {errorStatus.prettyPrint()} at {errorIndex}")
            return None

        return str(varBinds[0][1])
    except Exception as e:
        logger.error(f"Exception during SNMP GET for {ip}:{port} OID {oid}: {e}")
        return None
    finally:
        # Clean up transport target if created
        if transport is not None:
            try:
                await transport.close()
            except Exception as e:
                logger.warning(f"Error closing SNMP transport: {e}")

async def poll_snmp_device(ip: str, oids: list, community: str = 'public', port: int = 161, scan_time_s: int = 60):
    """
    Poll a device using SNMP GET requests for given OIDs at regular intervals.
    """
    results = {}
    
    try:
        while True:
            for oid in oids:
                result = await snmp_get(ip, oid, community, port)
                if result is not None:
                    results[oid] = result
                    logger.info(f"SNMP GET {oid}: {result}")
                else:
                    logger.error(f"SNMP GET {oid} failed")
            await asyncio.sleep(scan_time_s)
    except Exception as e:
        logger.exception(f"Exception during SNMP polling: {e}")

    return results

