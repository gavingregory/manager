import clone from 'lodash/clone';
import omitBy from 'lodash/omitBy';

import { actions } from '../generic/linodes';
import { fetch } from '../fetch';
import { createHeaderFilter } from '../util';


export function ipv4s(region) {
  return async (dispatch, getState) => {
    const ips = await dispatch(fetch.get(
      '/networking/ipv4',
      undefined,
      createHeaderFilter({ region })));

    // We'll save all IPs at once at the end of organizing them.
    const _ipsByLinode = {};
    const { linodes } = getState().api.linodes;

    Object.values(ips.data).forEach(function (ip) {
      const id = ip.linode_id;

      // We need to retain all ipv6s.
      if (!_ipsByLinode[id]) {
        _ipsByLinode[id] = {};

        const currentLinode = linodes[id] || {};

        const currentIPv6s = Object.keys(currentLinode._ips || {}).filter(
          key => currentLinode._ips[key].version !== 'ipv4');

        currentIPv6s.forEach(function (key) {
          _ipsByLinode[id][key] = currentLinode._ips[key];
        });
      }

      _ipsByLinode[id] = {
        ..._ipsByLinode[id],
        [ip.address]: {
          ...ip,
          version: 'ipv4',
        },
      };
    });

    return Object.keys(_ipsByLinode).map(function (id) {
      const _ips = _ipsByLinode[id];
      return dispatch(actions.one({ _ips }, id));
    });
  };
}

export function assignIPs(region, assignments) {
  return async function (dispatch, getState) {
    const { linodes } = getState().api.linodes;
    const data = { region, assignments: [] };

    // Since we'll dispatch for each transfer we want to keep track of
    // the (current) state of the _ips, not their original state.
    const _ipsByLinode = {};
    function copyIPsInitially(id) {
      if (!_ipsByLinode[id]) {
        _ipsByLinode[id] = clone(linodes[id]._ips);
      }
    }

    assignments.forEach(function (assignment) {
      const { ip: { address, linode_id: currentLinodeId }, id } = assignment;

      // Format for API.
      data.assignments.push({ address, linode_id: id });

      // Grab (and modify copy of) current IPs.
      copyIPsInitially(currentLinodeId);
      copyIPsInitially(id);

      const currentLinodeIPs = _ipsByLinode[currentLinodeId];
      delete currentLinodeIPs[address];
      const otherLinodeIPs = _ipsByLinode[id];
      otherLinodeIPs[address] = {
        ...assignment.ip,
        linode_id: id,
      };
    });

    await dispatch(fetch.post('/networking/ip-assign', data));

    // Only change state after post above succeeds.
    await Promise.all(Object.keys(_ipsByLinode).map(function (id) {
      const _ips = _ipsByLinode[id];

      // The ipv4 list on the linode needs to be updated for the Linode list
      // and dashboard pages.
      const ipv4 = Object.values(_ips).filter(
        ip => ip.version === 'ipv4').map(({ address }) => address);

      dispatch(actions.one({ _ips, ipv4 }, id));
    }));
  };
}

export function setRDNS(ip, linodeId, rdns) {
  return async function (dispatch, getState) {
    const { address, version } = ip;
    const rawAddress = address.split('/')[0].trim();
    let _ip = await dispatch(fetch.put(`/linode/instances/${linodeId}/ips/${rawAddress}`,
      { rdns }));

    // for ipv4 the response is an object
    // for ipv6 the response is an array
    _ip = Array.isArray(_ip) ? _ip.find(x => x.address === rawAddress) : _ip;

    const { _ips } = getState().api.linodes.linodes[linodeId];
    return dispatch(actions.one({
      _ips: {
        ..._ips,
        [_ip.address]: {
          ..._ip,
          version: version,
        },
      },
    }, linodeId));
  };
}

export function addIP(linodeId, type) {
  return async (dispatch, getState) => {
    const { _ips } = getState().api.linodes.linodes[linodeId];

    const ip = await dispatch(
      fetch.post(`/linode/instances/${linodeId}/ips`, { type }));

    return dispatch(actions.one({
      _ips: {
        ..._ips,
        [ip.address]: {
          ...ip,
          version: 'ipv4',
        },
      },
    }, linodeId));
  };
}

export function getIPs(linodeId) {
  return async function (dispatch) {
    const ips = await dispatch(fetch.get(`/linode/instances/${linodeId}/ips`));

    const _ips = {};
    [...ips.ipv4.public, ...ips.ipv4.private].forEach(function (ip) {
      _ips[ip.address] = {
        ...ip,
        version: 'ipv4',
      };
    });

    if (ips.ipv6.link_local) {
      _ips[ips.ipv6.link_local] = {
        address: ips.ipv6.link_local,
        type: 'link-local',
        version: 'ipv6',
      };
    }

    if (ips.ipv6.slaac) {
      _ips[ips.ipv6.slaac.address] = {
        ...ips.ipv6.slaac,
        type: 'slaac',
        version: 'ipv6',
      };
    }

    ips.ipv6.global.forEach(function (ip) {
      _ips[ip.range] = {
        ...ip,
        type: 'pool',
        version: 'ipv6',
      };
    });

    ips.ipv6.addresses.forEach(function (ip) {
      _ips[ip.address] = {
        ...ip,
        version: 'ipv6',
      };
    });

    dispatch(actions.one({ _ips, _shared: ips.ipv4.shared }, linodeId));
  };
}

export function setShared(linodeId, ips) {
  return async function (dispatch) {
    const data = { ips: ips.map(({ address }) => address) };
    await dispatch(fetch.post(`/linode/instances/${linodeId}/ips/sharing`, data));

    dispatch(actions.one({ _shared: ips }, linodeId));
  };
}

export function deleteIP(ip, linodeId) {
  return async function (dispatch, getState) {
    await dispatch(fetch.delete(`/networking/ipv4/${ip.address}`));

    const linode = getState().api.linodes.linodes[linodeId];
    const _ips = omitBy(linode._ips, (_, key) => key === ip.address);
    dispatch(actions.one({ _ips }, linode.id));
  };
}
