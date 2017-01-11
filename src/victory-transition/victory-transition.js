import React from "react";
import VictoryAnimation from "../victory-animation/victory-animation";
import { Transitions, Collection, Timer } from "../victory-util/index";
import { defaults, isFunction, pick } from "lodash";

export default class VictoryTransition extends React.Component {
  static displayName = "VictoryTransition";

  static propTypes = {
    animate: React.PropTypes.object,
    children: React.PropTypes.node,
    animationWhitelist: React.PropTypes.array
  };

  constructor(props) {
    super(props);
    this.state = {
      nodesShouldLoad: false,
      nodesDoneLoad: false
    };
    const child = this.props.children;
    this.continuous = child.type && child.type.continuous === true;
    this.getTransitionState = this.getTransitionState.bind(this);
    this.getTimer = this.getTimer.bind(this);
  }

  getTimer() {
    if (this.context.getTimer) {
      return this.context.getTimer();
    }
    if (!this.timer) {
      this.timer = new Timer();
    }
    return this.timer;
  }

  componentDidMount() {
    this.setState({nodesShouldLoad: true}); //eslint-disable-line react/no-did-mount-set-state
  }

  componentWillUnmount() {
    this.getTimer().stop();
  }

  componentWillReceiveProps(nextProps) {
    this.getTimer().bypassAnimation();
    this.setState(
      this.getTransitionState(this.props, nextProps), () => this.getTimer().resumeAnimation()
    );
  }

  getTransitionState(props, nextProps) {
    const { animate } = props;
    if (!animate) {
      return {};
    } else if (animate.parentState) {
      const state = animate.parentState;
      const oldProps = state.nodesWillExit ? props : null;
      return {oldProps, nextProps};
    } else {
      const oldChildren = React.Children.toArray(props.children);
      const nextChildren = React.Children.toArray(nextProps.children);
      const {
        nodesWillExit,
        nodesWillEnter,
        childrenTransitions,
        nodesShouldEnter
      } = Transitions.getInitialTransitionState(oldChildren, nextChildren);
      return {
        nodesWillExit,
        nodesWillEnter,
        childrenTransitions,
        nodesShouldEnter,
        oldProps: nodesWillExit ? props : null,
        nextProps
      };
    }
  }

  getDomainFromChildren(props, axis) {
    const getChildDomains = (children) => {
      return children.reduce((memo, child) => {
        if (child.type && isFunction(child.type.getDomain)) {
          const childDomain = child.props && child.type.getDomain(child.props, axis);
          return childDomain ? memo.concat(childDomain) : memo;
        } else if (child.props && child.props.children) {
          return memo.concat(getChildDomains(React.Children.toArray(child.props.children)));
        }
        return memo;
      }, []);
    };

    const child = React.Children.toArray(props.children)[0];
    const childProps = child.props || {};
    const domain = Array.isArray(childProps.domain) ?
      childProps.domain : childProps.domain && childProps.domain[axis];
    if (!childProps.children && domain) {
      return domain;
    } else {
      const childDomains = getChildDomains([child]);
      return childDomains.length === 0 ?
        [0, 1] : [Collection.getMinValue(childDomains), Collection.getMaxValue(childDomains)];
    }
  }

  pickProps() {
    if (!this.state) {
      return this.props;
    }
    return this.state.nodesWillExit ? this.state.oldProps || this.props : this.props;
  }

  pickDomainProps(props) {
    const parentState = props.animate && props.animate.parentState;
    if (parentState && parentState.nodesWillExit) {
      return this.continous || parentState.continuous ?
        parentState.nextProps || this.state.nextProps || props : props;
    }
    return this.continuous && this.state.nodesWillExit ? this.state.nextProps || props : props;
  }

  getClipProps(props, child) {
    if (!this.continuous) {
      return {};
    }
    const clipWidth = this.transitionProps && this.transitionProps.clipWidth;
    return {
      clipHeight: child.props.height,
      clipWidth: clipWidth !== undefined ? clipWidth : child.props.width
    };
  }

  render() {
    const props = this.pickProps();
    const getTransitionProps = this.props.animate && this.props.animate.getTransitions ?
      this.props.animate.getTransitions :
      Transitions.getTransitionPropsFactory(
        props,
        this.state,
        (newState) => this.setState(newState)
      );
    const child = React.Children.toArray(props.children)[0];
    const transitionProps = getTransitionProps(child);
    this.transitionProps = transitionProps;
    const domain = {
      x: this.getDomainFromChildren(this.pickDomainProps(props), "x"),
      y: this.getDomainFromChildren(props, "y")
    };
    const clipProps = this.getClipProps(props, child);
    const combinedProps = defaults(
      {domain}, clipProps, transitionProps, child.props
    );
    const animationWhitelist = props.animationWhitelist || [];
    const whitelist = this.continuous ?
      animationWhitelist.concat(["clipWidth", "clipHeight", "translateX"]) : animationWhitelist;
    const propsToAnimate = whitelist.length ? pick(combinedProps, whitelist) : combinedProps;
    return (
      <VictoryAnimation {...combinedProps.animate} data={propsToAnimate}>
        {(newProps) => {
          if (this.continuous) {
            const { clipWidth, clipHeight, translateX, padding } = newProps;
            const groupComponent = React.cloneElement(
              child.props.groupComponent,
              { clipWidth, clipHeight, translateX, padding }
            );
            return React.cloneElement(
              child, defaults({animate: null, groupComponent}, newProps, combinedProps)
            );
          }
          return React.cloneElement(
            child, defaults({animate: null}, newProps, combinedProps)
          );
        }}
      </VictoryAnimation>
    );
  }
}
