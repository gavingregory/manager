/* eslint-disable max-len */
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import {
  Form,
  FormGroup,
  FormGroupError,
  FormSummary,
  Select,
  SubmitButton,
} from 'linode-components';
import { onChange } from 'linode-components';
import sortBy from 'lodash/sortBy';
import find from 'lodash/find';
import api from '~/api';
import { dispatchOrStoreErrors } from '~/api/util';

const dayOptions = [
  { value: 'Scheduling', label: 'Choose a day' },
  { value: 'Sunday', label: 'Sunday' },
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
];

// If the adjusted time falls on an odd hour, we drop it back by one.
const shift = (n) => {
  if (n === 0) return n;
  return (n % 2 === 0) ? n : n - 1;
};

/**
 * Given a timezone return a list of options where the value is the
 * adjusted window for the supplied timezone.
 *
 * Note; The addition of 1 and 2 hours is per an offset at the API level.
 *
 * @param {string} timezone
 * @returns {ScheduleOptions[]}
 */
export function createAdjustedScheduleOptions(timezone, day) {
  const format = 'HH:mm';
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = days.indexOf(day.toLowerCase());

  let list = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour) => {
    const start = moment.utc({ hour })
      .day(idx)
      .add(moment.duration({ hours: 1 }))
      .tz(timezone);

    const finish = moment.utc({ hour })
      .day(idx)
      .add(moment.duration({ hours: 3 }))
      .tz(timezone);

    return {
      start,
      finish,
      label: `${start.format(format)} - ${finish.format(format)}`,
      value: `W${shift(moment.utc({ hour }).format('H'))}`,
    };
  });

  list = sortBy(list, (i) => i.label);

  list.unshift({ label: 'Choose a time', value: '' });

  return list;
}

export class ScheduleForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      errors: {},
      loading: false,
      window: props.window,
      day: props.day,
    };

    this.onChange = onChange.bind(this);
    this.disabledChildren = this.disabledChildren.bind(this);
  }

  onSubmit = () => {
    const { dispatch, linode } = this.props;
    const { day, window } = this.state;

    return dispatch(dispatchOrStoreErrors.call(this, [
      () => api.linodes.put({ backups: { schedule: { day, window } } }, linode.id),
    ]));
  }

  disabledChildren() {
    if (this.state.loading) {
      return 'Saving';
    }
    if (this.state.day === 'Scheduling' || !this.state.window || this.state.window === '') {
      return 'Save';
    }
  }

  render() {
    const { errors, loading, window, day } = this.state;
    const { tz } = this.props;
    const dayIsSet = day !== 'Scheduling';
    const timeIsSet = window && window !== '';
    const isScheduled = timeIsSet && dayIsSet;
    const adjustedScheduleOptions = createAdjustedScheduleOptions(tz, day);
    const scheduleOption = find(adjustedScheduleOptions, (i) => i.value === window);
    const { start, finish } = scheduleOption;
    const timezoneAbbr = moment.tz(tz).format('z');

    return (
      <Form
        onSubmit={this.onSubmit}
        analytics={{ title: 'Backups Schedule' }}
      >
        <FormGroup name="day" errors={errors} className="row">
          <label htmlFor="day" className="col-sm-2 col-form-label">Day of Week</label>
          <div className="col-sm-10 clearfix">
            <Select
              id="day"
              name="day"
              value={day}
              onChange={this.onChange}
              className="float-sm-left"
              options={dayOptions}
            />
            {isScheduled && <small className="form-text text-muted">
              Weekly Backups will be attempted between {start.format('dddd HH:mm z')}
              &nbsp;and {finish.format('dddd HH:mm z')}.
            </small>}
            <FormGroupError errors={errors} name="day" />
          </div>
        </FormGroup>
        {dayIsSet && <FormGroup name="window" errors={errors} className="row">
          <label htmlFor="window" className="col-sm-2 col-form-label">
            Time of Day ({timezoneAbbr})
          </label>
          <div className="col-sm-10">
            <Select
              id="window"
              name="window"
              value={dayIsSet ? window : ''}
              onChange={this.onChange}
              options={adjustedScheduleOptions}
            />
            {isScheduled && <small className="form-text text-muted">
              Daily backups will be attempted {start.format('HH:mm z')} - {finish.format('HH:mm z')}.
            </small>}
            <FormGroupError errors={errors} name="day" />
          </div>
        </FormGroup>}
        <FormGroup name="submit" className="row">
          <div className="offset-sm-2 col-sm-10">
            <SubmitButton
              disabled={loading || !dayIsSet || !timeIsSet}
              disabledChildren={this.disabledChildren()}
            />
            <FormSummary errors={errors} success="Schedule settings saved." />
          </div>
        </FormGroup>
      </Form>
    );
  }
}
const mapStateToProps = (state) => ({
  tz: state.api.profile.timezone,
});

export default connect(mapStateToProps)(ScheduleForm);

ScheduleForm.propTypes = {
  window: PropTypes.string.isRequired,
  day: PropTypes.string.isRequired,
  linode: PropTypes.object.isRequired,
  dispatch: PropTypes.func.isRequired,
  tz: PropTypes.string.isRequired,
};
