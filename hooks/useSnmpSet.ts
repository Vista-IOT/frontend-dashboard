import { useState, useCallback } from "react";

export interface SnmpSetParams {
	device: any;
	oid: string;
	value: string;
	type:
		| "Integer32"
		| "Unsigned"
		| "Float"
		| "String"
		| "Oid"
		| "OctetString"
		| "Timeticks"
		| "Boolean";
	timeoutMs?: number;
	retries?: number;
}

export interface SnmpSetResult {
	success: boolean;
	message?: string;
}

export function useSnmpSet() {
	const [isSetting, setIsSetting] = useState(false);

	const snmpSet = useCallback(async (params: SnmpSetParams): Promise<SnmpSetResult> => {
		setIsSetting(true);
		try {
			const {
				device,
				oid,
				value,
				type,
				timeoutMs = 2000,
				retries = 1,
			} = params;

			const payload = {
				device: {
					name: device?.name,
					ip: device?.ipAddress || device?.ip,
					port: device?.portNumber || device?.port || 161,
				},
				snmp: {
					version: device?.snmpVersion || "v2c",
					community: device?.community || device?.readCommunity || undefined,
					v3: {
						securityLevel: device?.snmpV3SecurityLevel,
						username: device?.snmpV3Username,
						authProtocol: device?.snmpV3AuthProtocol,
						authPassword: device?.snmpV3AuthPassword,
						privProtocol: device?.snmpV3PrivProtocol,
						privPassword: device?.snmpV3PrivPassword,
						contextName: device?.snmpV3ContextName,
						contextEngineId: device?.snmpV3ContextEngineId,
					},
				},
				operation: { oid, type, value, timeoutMs, retries },
			};

			const res = await fetch("/deploy/api/snmp/set", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				let message = `SNMP SET failed (${res.status})`;
				try {
					const err = await res.json();
					message = err?.message || err?.error || message;
				} catch {}
				return { success: false, message };
			}

			const data = await res.json().catch(() => ({}));
			return { success: true, message: data?.message || "OK" };
		} catch (e: any) {
			return { success: false, message: e?.message || String(e) };
		} finally {
			setIsSetting(false);
		}
	}, []);

	return { snmpSet, isSetting };
}


