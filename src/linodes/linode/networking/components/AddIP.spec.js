import { mount, shallow } from 'enzyme';
import React from 'react';
import sinon from 'sinon';

import AddIP from '~/linodes/linode/networking/components/AddIP';

import { expectDispatchOrStoreErrors, expectRequest } from '~/test.helpers';
import { testLinode } from '~/data/linodes';


describe('linodes/linode/networking/components/AddIP', () => {
  const sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  const dispatch = sandbox.stub();

  it('should render without error', () => {
    const wrapper = shallow(
      <AddIP
        linode={testLinode}
        dispatch={dispatch}
        close={dispatch}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it.skip('submits data onsubmit and closes modal', async () => {
    const page = mount(
      <AddIP
        linode={testLinode}
        dispatch={dispatch}
        close={dispatch}
      />
    );


    dispatch.reset();
    await page.find('Form').props().onSubmit({ preventDefault() { } });

    expect(dispatch.callCount).toBe(1);
    await expectDispatchOrStoreErrors(dispatch.firstCall.args[0], [
      ([fn]) => expectRequest(fn, `/linode/instances/${testLinode.id}/ips`, {
        method: 'POST',
        body: { type: 'public' },
      }, { address: '192.168.1.1' }),
    ]);
  });
});
